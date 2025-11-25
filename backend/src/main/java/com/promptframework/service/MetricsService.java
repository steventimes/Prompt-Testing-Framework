package com.promptframework.service;

import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.entity.TestResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MetricsService {

    public TestRunResponse.MetricsSummary calculateMetrics(List<TestResult> results) {
        if (results == null || results.isEmpty()) {
            return createEmptyMetrics();
        }

        double avgResponseTime = results.stream()
                .mapToInt(TestResult::getResponseTimeMs)
                .average()
                .orElse(0.0);

        double avgQualityScore = results.stream()
                .mapToDouble(TestResult::getQualityScore)
                .average()
                .orElse(0.0);

        int totalTokens = results.stream()
                .mapToInt(TestResult::getTokenCount)
                .sum();

        double totalCost = results.stream()
                .map(TestResult::getCostUsd)
                .map(BigDecimal::doubleValue)
                .reduce(0.0, Double::sum);

        TestRunResponse.MetricsSummary metrics = new TestRunResponse.MetricsSummary();
        metrics.setAverageResponseTimeMs(avgResponseTime);
        metrics.setAverageQualityScore(avgQualityScore);
        metrics.setTotalTokens(totalTokens);
        metrics.setTotalCostUsd(totalCost);

        return metrics;
    }

    private TestRunResponse.MetricsSummary createEmptyMetrics() {
        TestRunResponse.MetricsSummary metrics = new TestRunResponse.MetricsSummary();
        metrics.setAverageResponseTimeMs(0.0);
        metrics.setAverageQualityScore(0.0);
        metrics.setTotalTokens(0);
        metrics.setTotalCostUsd(0.0);
        return metrics;
    }
}
