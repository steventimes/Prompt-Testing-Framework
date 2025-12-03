package com.promptframework.controller;

import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.QuickTestResult;
import com.promptframework.model.dto.QuickTestResponse;
import com.promptframework.service.AIExecutionService;
import com.promptframework.service.TestRunService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test-runs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class TestRunController {

    private final TestRunService testRunService;

    @PostMapping
    public ResponseEntity<TestRunResponse> executeTest(
            @Valid @RequestBody TestRunRequest request) {
        return ResponseEntity.ok(testRunService.executeTest(request));
    }

    @GetMapping("{id}")
    public ResponseEntity<TestRunResponse> getTestRunById(@PathVariable Long id) {
        return ResponseEntity.ok(testRunService.getTestRun(id));
    }

    /**
     * Quick test, doesn't save to database
     */
    @PostMapping("/quick-test")
    public ResponseEntity<QuickTestResponse> quickTest(
            @Valid @RequestBody QuickTestRequest request) {

        log.info("Running quick test with provider: {}", request.getAiProvider());

        List<QuickTestResult> results = new ArrayList<>();
        AIExecutionService aiExecutionService = new AIExecutionService();
        request.getTestInputs().forEach(variables -> {
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
                result.setQualityScore(calculateSimpleQualityScore(aiResponse));

                results.add(result);
            } catch (Exception e) {
                log.error("Failed to execute quick test with variables: {}", variables, e);
            }
        });

        QuickTestResponse.MetricsSummary metrics = calculateQuickMetrics(results);

        QuickTestResponse response = new QuickTestResponse();
        response.setResults(results);
        response.setMetrics(metrics);
        response.setPromptContent(request.getPromptContent());
        response.setAiProvider(request.getAiProvider());
        response.setModelName(request.getModelName());

        return ResponseEntity.ok(response);
    }

    private double calculateSimpleQualityScore(AIExecutionService.AIResponse response) {
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

    private QuickTestResponse.MetricsSummary calculateQuickMetrics(List<QuickTestResult> results) {
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
