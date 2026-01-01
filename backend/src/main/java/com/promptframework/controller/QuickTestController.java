package com.promptframework.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.QuickTestResponse;
import com.promptframework.model.dto.QuickTestResult;
import com.promptframework.service.AIExecutionService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/quick-test")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class QuickTestController {

    private final AIExecutionService aiExecutionService;

    @PostMapping
    public ResponseEntity<QuickTestResponse> quickTest(
            @Valid @RequestBody QuickTestRequest request,
            @RequestHeader(value = "X-API-KEY", required = false) String apiKey) {

        log.info("Running quick test with provider: {}, model: {}",
                request.getAiProvider(), request.getModelName());

        List<QuickTestResult> results = new ArrayList<>();

        for (Map<String, String> variables : request.getTestInputs()) {
            try {
                AIExecutionService.AIResponse aiResponse = aiExecutionService.execute(
                        request.getPromptContent(),
                        variables,
                        request.getAiProvider(),
                        request.getModelName(),
                        apiKey
                );

                QuickTestResult result = new QuickTestResult();
                result.setInputVariables(variables);
                result.setAiResponse(aiResponse.getResponseText());
                result.setResponseTimeMs(aiResponse.getResponseTimeMs());
                result.setTokenCount(aiResponse.getTokenCount());
                result.setCostUsd(aiResponse.getCostUsd());
                result.setQualityScore(calculateScore(aiResponse));

                results.add(result);

            } catch (Exception e) {
                log.error("Error executing quick test", e);
            }
        }

        QuickTestResponse response = new QuickTestResponse();
        response.setPromptContent(request.getPromptContent());
        response.setAiProvider(request.getAiProvider());
        response.setModelName(request.getModelName());
        response.setResults(results);
        response.setMetrics(calculateMetrics(results));

        return ResponseEntity.ok(response);
    }

    private double calculateScore(AIExecutionService.AIResponse response) {
        double score = 0.5;
        int length = response.getResponseText().length();
        if (length > 100 && length < 500) {
            score += 0.2;
        }
        if (response.getResponseTimeMs() < 1000) {
            score += 0.2;
        }
        if (response.getCostUsd() < 0.01) {
            score += 0.1;
        }
        return Math.min(score, 1.0);
    }

    private QuickTestResponse.MetricsSummary calculateMetrics(List<QuickTestResult> results) {
        if (results.isEmpty()) {
            return new QuickTestResponse.MetricsSummary(0.0, 0.0, 0, 0.0);
        }

        double avgResponseTime = results.stream()
                .mapToInt(QuickTestResult::getResponseTimeMs)
                .average()
                .orElse(0.0);

        double avgQuality = results.stream()
                .mapToDouble(QuickTestResult::getQualityScore)
                .average()
                .orElse(0.0);

        int totalTokens = results.stream()
                .mapToInt(QuickTestResult::getTokenCount)
                .sum();

        double totalCost = results.stream()
                .mapToDouble(QuickTestResult::getCostUsd)
                .sum();

        return new QuickTestResponse.MetricsSummary(avgResponseTime, avgQuality, totalTokens, totalCost);
    }
}
