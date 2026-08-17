package com.promptframework.service;

import com.promptframework.model.dto.PrivacySummary;
import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.QuickTestResponse;
import com.promptframework.model.dto.QuickTestResult;
import com.promptframework.model.entity.TestResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QuickTestService {

    private final EvaluationService evaluationService;
    private final MetricsService metricsService;
    private final Clock clock;

    public QuickTestResponse execute(QuickTestRequest request) {
        List<TestResult> evaluations;
        if (request.getTestCases() != null && !request.getTestCases().isEmpty()) {
            evaluations = evaluationService.evaluateCases(
                    request.getPromptContent(),
                    request.getTestCases(),
                    request.getAiProvider(),
                    request.getModelName()
            );
        } else {
            evaluations = evaluationService.evaluate(
                    request.getPromptContent(),
                    request.getTestInputs(),
                    request.getAiProvider(),
                    request.getModelName()
            );
        }
        List<QuickTestResult> results = evaluations.stream().map(this::toQuickResult).toList();
        TestRunResponseAdapter metrics = new TestRunResponseAdapter(metricsService.calculateMetrics(evaluations));

        QuickTestResponse response = new QuickTestResponse();
        response.setId(UUID.randomUUID().toString());
        response.setExecutedAt(Instant.now(clock));
        response.setStatus(resolveStatus(evaluations));
        response.setPromptContent(request.getPromptContent());
        response.setAiProvider(request.getAiProvider());
        response.setModelName(request.getModelName());
        response.setResults(results);
        response.setMetrics(metrics.toQuickMetrics());
        return response;
    }

    private QuickTestResult toQuickResult(TestResult evaluation) {
        QuickTestResult result = new QuickTestResult();
        result.setCaseName(evaluation.getCaseName());
        result.setStatus(evaluation.getStatus());
        result.setErrorCode(evaluation.getErrorCode());
        result.setErrorMessage(evaluation.getErrorMessage());
        result.setInputVariables(evaluation.getInputVariables());
        result.setAiResponse(evaluation.getAiResponse());
        result.setResponseTimeMs(evaluation.getResponseTimeMs());
        result.setTokenCount(evaluation.getTokenCount());
        result.setCostUsd(evaluation.getCostUsd() == null ? null : evaluation.getCostUsd().doubleValue());
        result.setQualityScore(evaluation.getQualityScore());
        result.setAssertionPassed(evaluation.getAssertionPassed());
        result.setAssertionResults(evaluation.getAssertionResults());
        result.setMcpCalls(evaluation.getMcpCalls());
        if (evaluation.getPrivacyRiskScore() != null || evaluation.getPrivacyFlags() != null) {
            result.setPrivacySummary(new PrivacySummary(
                    evaluation.getPrivacyRiskScore(),
                    evaluation.getPrivacyFlags() == null ? List.of() : evaluation.getPrivacyFlags()
            ));
        }
        return result;
    }

    private String resolveStatus(List<TestResult> results) {
        long completed = results.stream().filter(result -> "COMPLETED".equals(result.getStatus())).count();
        if (completed == results.size()) {
            return "COMPLETED";
        }
        return completed == 0 ? "FAILED" : "PARTIAL";
    }

    /**
     * 适配持久化实验与临时实验的指标 DTO，保证数值口径只有 MetricsService 一处实现。
     */
    private record TestRunResponseAdapter(com.promptframework.model.dto.TestRunResponse.MetricsSummary metrics) {

        private QuickTestResponse.MetricsSummary toQuickMetrics() {
            return new QuickTestResponse.MetricsSummary(
                    metrics.getAverageResponseTimeMs(),
                    metrics.getAverageQualityScore(),
                    metrics.getQualityScoredCases(),
                    metrics.getQualityCoverage(),
                    metrics.getTotalTokens(),
                    metrics.getTotalCostUsd(),
                    metrics.getAveragePrivacyRiskScore(),
                    metrics.getTotalPrivacyFindings(),
                    metrics.getCompletedCases(),
                    metrics.getFailedCases(),
                    metrics.getTotalAssertions(),
                    metrics.getPassedAssertions(),
                    metrics.getFailedAssertions(),
                    metrics.getAssertionPassRate()
            );
        }
    }
}
