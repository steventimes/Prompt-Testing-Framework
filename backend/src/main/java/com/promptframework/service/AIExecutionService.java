package com.promptframework.service;

import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
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
            String aiProvider, String modelName, String apiKeyOverride) {

        boolean shouldMock = globalMockMode;
        if (apiKeyOverride != null && !apiKeyOverride.isBlank()) {
            shouldMock = false;
        } else if (globalChatModel.isEmpty() && (apiKeyOverride == null || apiKeyOverride.isBlank())) {
            shouldMock = true;
        }
        AIResponse response;
        if (shouldMock) {
            response = executeMock(promptContent, variables, aiProvider, modelName);
        } else {
            response = executeReal(promptContent, variables, aiProvider, modelName, apiKeyOverride);
        }

        if (!shouldMock && response.getResponseText() != null) {
            double qualityScore = evaluateQuality(promptContent, response.getResponseText(), apiKeyOverride);
            response.setQualityScore(qualityScore);
        } else {
            // Mock scoring
            response.setQualityScore(0.7 + (random.nextDouble() * 0.2));
        }

        return response;
    }

    private AIResponse executeReal(String promptContent, Map<String, String> variables,
            String provider, String modelName, String apiKeyOverride) {

        String finalPrompt = resolveVariables(promptContent, variables);
        ChatLanguageModel modelToUse = buildModel(modelName, apiKeyOverride);

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
    private double evaluateQuality(String originalPrompt, String aiOutput, String apiKeyOverride) {
        try {
            ChatLanguageModel judgeModel = buildModel("gpt-3.5-turbo", apiKeyOverride);

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

    private ChatLanguageModel buildModel(String modelName, String apiKeyOverride) {
        if (apiKeyOverride != null && !apiKeyOverride.isBlank()) {
            return OpenAiChatModel.builder().apiKey(apiKeyOverride).modelName(modelName).build();
        }
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
    }
}
