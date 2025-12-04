package com.promptframework.controller;

import com.promptframework.model.dto.*;
import com.promptframework.service.AIExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Controller for quick, ephemeral prompt tests that don't save to database.
 * Useful for rapid experimentation without cluttering test history.
 */
@RestController
@RequestMapping("/api/quick-test")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class QuickTestController {

    private final AIExecutionService aiExecutionService;

    /**
     * Run a quick test without saving to database POST /api/quick-test
     */
    @PostMapping
    public ResponseEntity<QuickTestResponse> quickTest(
            @Valid @RequestBody QuickTestRequest request) {

        log.info("Running quick test with provider: {}, model: {}",
                request.getAiProvider(), request.getModelName());

        List<QuickTestResult> results = new ArrayList<>();

        for (Map<String, String> variables : request.getTestInputs()) {
            try {
                AIExecutionService.AIResponse aiResponse = aiExecutionService.execute(
                        request.getPromptContent(),
                        variables,
                        request.getAiProvider(),
                        request.getModelName()
                );

                QuickTestResult result = new QuickTestResult();
                result.setInputVariables(variables);
                result.setAiResponse(aiResponse.getResponseText());
                result.setResponseTimeMs(aiResponse.getResponseTimeMs());
                result.setTokenCount(aiResponse.getTokenCount());
                result.setCostUsd(aiResponse.getCostUsd());
                result.setQualityScore(calculateQualityScore(aiResponse));

                results.add(result);
            } catch (Exception e) {
                log.error("Failed to execute quick test with input: {}", variables, e);
            }
        }

        QuickTestResponse.MetricsSummary metrics = calculateMetrics(results);

        QuickTestResponse response = new QuickTestResponse();
        response.setResults(results);
        response.setMetrics(metrics);
        response.setPromptContent(request.getPromptContent());
        response.setAiProvider(request.getAiProvider());
        response.setModelName(request.getModelName());

        log.info("Quick test completed with {} results", results.size());
        return ResponseEntity.ok(response);
    }

    /**
     * Calculate quality score based on response characteristics
     */
    private double calculateQualityScore(AIExecutionService.AIResponse response) {
        double score = 0.5;  // Base score

        int length = response.getResponseText().length();
        if (length > 100 && length < 500) {
            score += 0.2;  // Good length
        }
        if (response.getResponseTimeMs() < 1000) {
            score += 0.2;  // Fast response
        }
        if (response.getCostUsd() < 0.01) {
            score += 0.1;  // Cost effective
        }
        return Math.min(score, 1.0);
    }

    /**
     * Calculate aggregate metrics across all test results
     */
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

        return new QuickTestResponse.MetricsSummary(
                avgResponseTime, avgQuality, totalTokens, totalCost
        );
    }
}
