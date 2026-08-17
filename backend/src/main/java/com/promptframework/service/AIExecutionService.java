package com.promptframework.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.promptframework.exception.PromptExecutionException;
import com.promptframework.model.dto.McpToolCall;
import com.promptframework.model.dto.PrivacySummary;
import com.promptframework.model.dto.PromptTemplateAnalysis;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AIExecutionService {

    private final boolean globalMockMode;
    private final ChatModelResolver chatModelResolver;
    private final PromptTemplateService promptTemplateService;
    private final QualityScoreParser qualityScoreParser = new QualityScoreParser();

    public AIExecutionService(
            @Value("${ai.mock-mode:false}") boolean globalMockMode,
            ChatModelResolver chatModelResolver,
            PromptTemplateService promptTemplateService
    ) {
        this.globalMockMode = globalMockMode;
        this.chatModelResolver = chatModelResolver;
        this.promptTemplateService = promptTemplateService;
    }

    /**
     * 执行 Prompt，并使用与本次请求相同的模型裁判自动评估输出质量。
     */
    public AIResponse execute(String promptContent, Map<String, String> variables,
            String aiProvider, String modelName) {

        PromptTemplateAnalysis template = promptTemplateService.analyze(promptContent, variables);
        if (!template.complete()) {
            throw new PromptExecutionException(
                    "PROMPT_VARIABLES_MISSING",
                    "缺少 Prompt 变量: " + String.join(", ", template.missingVariables())
            );
        }

        AIResponse response;
        if (globalMockMode) {
            response = executeMock(template.renderedContent(), aiProvider, modelName);
            response.setQualityScore(deterministicQuality(template.renderedContent(), aiProvider, modelName));
        } else {
            // 每个运行按请求坐标解析一次，生成和裁判复用同一个客户端。
            ChatModel requestModel = chatModelResolver.resolve(aiProvider, modelName);
            response = executeReal(template.renderedContent(), aiProvider, modelName, requestModel);
            QualityEvaluation quality = evaluateQuality(requestModel,
                    template.renderedContent(), response.getResponseText());
            response.setQualityScore(quality.score());
            response.setTokenCount(sumUsage(response.getTokenCount(), quality.tokenCount()));
        }

        response.setMcpCalls(generateMcpCalls(promptContent, variables));
        response.setPrivacySummary(evaluatePrivacy(template.renderedContent(), Map.of(), response.getResponseText()));

        return response;
    }

    private AIResponse executeReal(
            String promptContent,
            String provider,
            String modelName,
            ChatModel modelToUse
    ) {
        long startTime = System.currentTimeMillis();
        ChatResponse generation;
        try {
            generation = modelToUse.chat(UserMessage.from(promptContent));
        } catch (Exception exception) {
            throw new PromptExecutionException("PROVIDER_EXECUTION_FAILED", "模型调用失败", exception);
        }
        long endTime = System.currentTimeMillis();

        String responseText = responseText(generation);
        if (responseText == null || responseText.isBlank()) {
            throw new PromptExecutionException("PROVIDER_EMPTY_RESPONSE", "模型返回了空响应");
        }

        AIResponse response = new AIResponse();
        response.setResponseText(responseText);
        response.setResponseTimeMs((int) (endTime - startTime));
        response.setProvider(provider);
        response.setModel(modelName);
        response.setMock(false);
        // 真实 Token 只采信供应商返回的 usage；缺失时不能退回字符估算。
        response.setTokenCount(tokenCount(generation));
        // 未配置按供应商/模型版本核验的价格表，真实调用成本必须明确为未知。
        response.setCostUsd(null);

        return response;
    }

    /**
     * 模型裁判：保留裁判 usage，即使评分文本格式非法也不丢弃已获得的计量证据。
     */
    private QualityEvaluation evaluateQuality(ChatModel judgeModel, String originalPrompt, String aiOutput) {
        try {
            String gradingPrompt = String.format("""
                                                 You are an AI Quality Judge. Rate the following AI response on a scale of 0.0 to 1.0 based on helpfulness, clarity, and adherence to instructions.
                                                 Only return the number, nothing else.
                                                 
                                                 Original Prompt: %s
                                                 
                                                 AI Response: %s""",
                    originalPrompt.substring(0, Math.min(originalPrompt.length(), 500)),
                    aiOutput
            );
            ChatResponse judgeResponse = judgeModel.chat(UserMessage.from(gradingPrompt));
            return new QualityEvaluation(qualityScoreParser.parse(responseText(judgeResponse)), tokenCount(judgeResponse));
        } catch (Exception exception) {
            // 评分失败不应抹掉已经成功生成的主响应，也不能伪造中性分或部分 Token 总数。
            log.warn("自动质量评分失败，质量分与本次总 Token 留空", exception);
            return new QualityEvaluation(null, null);
        }
    }

    private String responseText(ChatResponse response) {
        if (response == null) {
            return null;
        }
        AiMessage message = response.aiMessage();
        return message == null ? null : message.text();
    }

    private Integer tokenCount(ChatResponse response) {
        return response == null || response.tokenUsage() == null
                ? null
                : response.tokenUsage().totalTokenCount();
    }

    private Integer sumUsage(Integer generationTokens, Integer judgeTokens) {
        if (generationTokens == null || judgeTokens == null) {
            return null;
        }
        try {
            return Math.addExact(generationTokens, judgeTokens);
        } catch (ArithmeticException overflow) {
            log.warn("模型 usage 总数溢出，Token 总数留空", overflow);
            return null;
        }
    }

    private AIResponse executeMock(String renderedPrompt, String provider, String modelName) {
        int fingerprint = Objects.hash(renderedPrompt, provider, modelName);
        AIResponse response = new AIResponse();
        response.setResponseText("[MOCK] 已完成模板渲染与执行模拟。\n\n" + renderedPrompt);
        response.setResponseTimeMs(180 + Math.floorMod(fingerprint, 241));
        response.setProvider(provider);
        response.setModel(modelName);
        response.setTokenCount(Math.max(1, renderedPrompt.length() / 4));
        response.setCostUsd(0.0);
        response.setMock(true);
        return response;
    }

    private double deterministicQuality(String promptContent, String provider, String modelName) {
        int fingerprint = Objects.hash(promptContent, provider, modelName, "quality");
        return 0.70 + (Math.floorMod(fingerprint, 21) / 100.0);
    }

    private List<McpToolCall> generateMcpCalls(String promptContent, Map<String, String> variables) {
        List<McpToolCall> calls = new ArrayList<>();
        calls.add(new McpToolCall("mcp.prompt.resolve", 12, "ok", "prompt-template"));
        if (variables != null && !variables.isEmpty()) {
            calls.add(new McpToolCall("mcp.variable.expand", 9, "ok", "inputs"));
        }

        String lowerPrompt = promptContent == null ? "" : promptContent.toLowerCase(Locale.ROOT);
        if (lowerPrompt.contains("http") || lowerPrompt.contains("url") || lowerPrompt.contains("browse")) {
            calls.add(new McpToolCall("mcp.http.fetch", 120, "skipped", "external-url"));
        }
        return calls;
    }

    private PrivacySummary evaluatePrivacy(String promptContent, Map<String, String> variables, String responseText) {
        StringBuilder combined = new StringBuilder();
        if (promptContent != null) {
            combined.append(promptContent).append(" ");
        }
        if (variables != null) {
            variables.values().forEach(value -> combined.append(value).append(" "));
        }
        if (responseText != null) {
            combined.append(responseText);
        }

        List<String> flags = new ArrayList<>();
        double score = 0.0;

        if (Pattern.compile("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE)
                .matcher(combined).find()) {
            flags.add("email");
            score += 0.2;
        }
        if (Pattern.compile("\\b\\d{3}-\\d{2}-\\d{4}\\b").matcher(combined).find()) {
            flags.add("ssn");
            score += 0.5;
        }
        if (Pattern.compile("\\b(?:\\d[ -]*?){13,16}\\b").matcher(combined).find()) {
            flags.add("credit-card");
            score += 0.5;
        }
        if (Pattern.compile("\\b(?:\\+?\\d{1,2}[-.\\s]?)?(?:\\(\\d{3}\\)|\\d{3})[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b")
                .matcher(combined).find()) {
            flags.add("phone");
            score += 0.2;
        }
        if (Pattern.compile("\\bsk-[A-Za-z0-9]{10,}\\b").matcher(combined).find()) {
            flags.add("api-key");
            score += 0.6;
        }

        score = Math.min(score, 1.0);
        return new PrivacySummary(score, flags);
    }

    private record QualityEvaluation(Double score, Integer tokenCount) {
    }

    @Data
    public static class AIResponse implements java.io.Serializable {

        private String responseText;
        private Integer responseTimeMs;
        private Integer tokenCount;
        private Double costUsd;
        private Double qualityScore;
        private String provider;
        private String model;
        private boolean mock;
        private List<McpToolCall> mcpCalls;
        private PrivacySummary privacySummary;
    }
}
