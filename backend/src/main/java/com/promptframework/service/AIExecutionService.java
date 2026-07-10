package com.promptframework.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.promptframework.model.dto.McpToolCall;
import com.promptframework.model.dto.PrivacySummary;

import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIExecutionService {

    @Value("${ai.mock-mode:false}")
    private boolean globalMockMode;

    private final Optional<ChatLanguageModel> globalChatModel;
    private final Random random = new Random();

    /**
     * Executes the prompt and then runs an automated evaluation
     * (LLM-as-a-Judge).
     */
    public AIResponse execute(String promptContent, Map<String, String> variables,
            String aiProvider, String modelName) {

        boolean shouldMock = globalMockMode;
        if (globalChatModel.isEmpty()) {
            shouldMock = true;
        }
        AIResponse response;
        if (shouldMock) {
            response = executeMock(promptContent, variables, aiProvider, modelName);
        } else {
            response = executeReal(promptContent, variables, aiProvider, modelName);
        }

        if (!shouldMock && response.getResponseText() != null) {
            double qualityScore = evaluateQuality(promptContent, response.getResponseText());
            response.setQualityScore(qualityScore);
        } else {
            // Mock scoring
            response.setQualityScore(0.7 + (random.nextDouble() * 0.2));
        }

        response.setMcpCalls(generateMcpCalls(promptContent, variables));
        response.setPrivacySummary(evaluatePrivacy(promptContent, variables, response.getResponseText()));

        return response;
    }

    private AIResponse executeReal(String promptContent, Map<String, String> variables,
            String provider, String modelName) {

        String finalPrompt = resolveVariables(promptContent, variables);
        ChatLanguageModel modelToUse = configuredModel();

        long startTime = System.currentTimeMillis();
        String responseText;
        try {
            responseText = modelToUse.generate(finalPrompt);
        } catch (Exception e) {
            log.error("AI Error", e);
            responseText = "Error: " + e.getMessage();
        }
        long endTime = System.currentTimeMillis();

        AIResponse response = new AIResponse();
        response.setResponseText(responseText);
        response.setResponseTimeMs((int) (endTime - startTime));
        response.setProvider(provider);
        response.setModel(modelName);
        response.setMock(false);
        // Estimate: 1 token ~= 4 chars
        response.setTokenCount(responseText.length() / 4);
        // Estimate: $0.002 per 1k tokens
        response.setCostUsd((response.getTokenCount() / 1000.0) * 0.002);

        return response;
    }

    /**
     * "LLM-as-a-Judge": Uses a cheaper model to grade the output.
     */
    private double evaluateQuality(String originalPrompt, String aiOutput) {
        try {
            ChatLanguageModel judgeModel = configuredModel();

            String gradingPrompt = String.format("""
                                                 You are an AI Quality Judge. Rate the following AI response on a scale of 0.0 to 1.0 based on helpfulness, clarity, and adherence to instructions.
                                                 Only return the number, nothing else.
                                                 
                                                 Original Prompt: %s
                                                 
                                                 AI Response: %s""",
                    originalPrompt.substring(0, Math.min(originalPrompt.length(), 500)),
                    aiOutput
            );

            String scoreStr = judgeModel.generate(gradingPrompt).trim();
            Matcher m = Pattern.compile("[0-1](\\.\\d+)?").matcher(scoreStr);
            if (m.find()) {
                return Double.parseDouble(m.group());
            }
            return 0.5;
        } catch (NumberFormatException e) {
            log.warn("Failed to auto-evaluate quality", e);
            return 0.0;
        }
    }

    private ChatLanguageModel configuredModel() {
        return globalChatModel.orElseThrow(() -> new RuntimeException("No API Key"));
    }

    private String resolveVariables(String content, Map<String, String> variables) {
        if (variables == null) {
            return content;
        }
        String result = content;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            result = result.replace("{{" + entry.getKey() + "}}", entry.getValue())
                    .replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return result;
    }

    private AIResponse executeMock(String promptContent, Map<String, String> variables, String provider, String modelName) {
        AIResponse res = new AIResponse();
        res.setResponseText("[MOCK] Response for: " + promptContent);
        res.setResponseTimeMs(150 + random.nextInt(100));
        res.setProvider(provider);
        res.setModel(modelName);
        res.setTokenCount(promptContent.length() / 4);
        res.setCostUsd(0.0);
        res.setMock(true);
        return res;
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
