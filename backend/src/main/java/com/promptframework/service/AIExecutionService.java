package com.promptframework.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIExecutionService {

    @Value("${ai.mock-mode:true}")
    private boolean mockMode;

    private final Random random = new Random();

    /**
     * mockMode stands for if want to generate some testing result instead of
     * using actual AI
     */
    @Cacheable(value = "aiResponses", key = "#promptContent + #variables.toString()")
    public AIResponse execute(String promptContent, Map<String, String> variables,
            String aiProvider, String modelName) {

        log.info("Executing prompt with provider: {}, model: {}, mock: {}",
                aiProvider, modelName, mockMode);

        if (mockMode) {
            return executeMock(promptContent, variables, aiProvider, modelName);
        } else {
            return executeReal(promptContent, variables, aiProvider, modelName);
        }
    }

    /**
     * generates realistic test data
     */
    private AIResponse executeMock(String promptContent, Map<String, String> variables,
            String aiProvider, String modelName) {

        // random processing time: 500-2000ms
        int responseTimeMs = 500 + random.nextInt(1500);

        String response = generateMockResponse(promptContent, variables);

        // Estimate tokens: ~4 chars per token
        int promptTokens = promptContent.length() / 4;
        int responseTokens = response.length() / 4;
        int totalTokens = promptTokens + responseTokens;

        // OpenAI GPT-4 pricing: ~$0.03/1K tokens
        double costUsd = (totalTokens / 1000.0) * 0.03;

        AIResponse aiResponse = new AIResponse();
        aiResponse.setResponseText(response);
        aiResponse.setResponseTimeMs(responseTimeMs);
        aiResponse.setTokenCount(totalTokens);
        aiResponse.setCostUsd(costUsd);
        aiResponse.setProvider(aiProvider);
        aiResponse.setModel(modelName);
        aiResponse.setMock(true);

        return aiResponse;
    }

    /**
     * Real implementation - calls actual AI APIs TODO: Implement when API keys
     * are available
     */
    private AIResponse executeReal(String promptContent, Map<String, String> variables,
            String aiProvider, String modelName) {
        throw new UnsupportedOperationException(
                "Real AI execution not yet implemented. Set ai.mock-mode=true"
        );

        // if (aiProvider.equals("openai")) {
        //     return callOpenAI(promptContent, variables, modelName);
        // } else if (aiProvider.equals("anthropic")) {
        //     return callAnthropic(promptContent, variables, modelName);
        // }
    }

    /**
     * mock response based on the prompt
     */
    private String generateMockResponse(String promptContent, Map<String, String> variables) {
        StringBuilder response = new StringBuilder();
        response.append("[MOCK RESPONSE] ");

        if (promptContent.toLowerCase().contains("summarize")) {
            response.append("This is a summary of the provided content. ");
        } else if (promptContent.toLowerCase().contains("question")) {
            response.append("Here's an answer to your question: ");
        } else {
            response.append("I understand you want me to ");
        }

        if (variables != null && !variables.isEmpty()) {
            response.append("For the inputs: ");
            variables.forEach((key, value)
                    -> response.append(key).append("=").append(value).append(", ")
            );
        }

        response.append("This response simulates the prompt execution. ");

        return response.toString();
    }

    @Data
    public static class AIResponse {

        private String responseText;
        private Integer responseTimeMs;
        private Integer tokenCount;
        private Double costUsd;
        private String provider;
        private String model;
        private boolean mock;
    }
}
