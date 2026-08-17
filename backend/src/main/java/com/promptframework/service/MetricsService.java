package com.promptframework.service;

import com.promptframework.model.dto.AssertionResult;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.entity.TestResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MetricsService {

    public TestRunResponse.MetricsSummary calculateMetrics(List<TestResult> results) {
        if (results == null || results.isEmpty()) {
            return createEmptyMetrics();
        }

        List<TestResult> executedResults = results.stream()
                .filter(result -> result != null
                        && (result.getAiResponse() != null || "COMPLETED".equals(result.getStatus())))
                .toList();

        // 聚合指标必须覆盖全部已执行用例；任一证据缺失就保留为未知。
        Double avgResponseTime = hasCompleteResponseTimeEvidence(executedResults)
                ? executedResults.stream()
                .map(TestResult::getResponseTimeMs)
                .mapToInt(Integer::intValue)
                .average()
                .orElseThrow()
                : null;

        List<Double> qualityScores = executedResults.stream()
                .map(TestResult::getQualityScore)
                .filter(Objects::nonNull)
                .toList();
        // 未获得裁判评分时保留“未知”，避免前端或回归门禁把它误解为零分。
        Double avgQualityScore = qualityScores.isEmpty()
                ? null
                : qualityScores.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        int qualityScoredCases = qualityScores.size();
        double qualityCoverage = executedResults.isEmpty()
                ? 0.0
                : (double) qualityScoredCases / executedResults.size();

        // Token 总数同样要求完整 usage 证据，不能用部分求和伪装成真实总量。
        Integer totalTokens = hasCompleteTokenEvidence(executedResults)
                ? executedResults.stream()
                .map(TestResult::getTokenCount)
                .mapToInt(Integer::intValue)
                .sum()
                : null;

        Double totalCost = hasCompleteCostEvidence(executedResults)
                ? executedResults.stream()
                .map(TestResult::getCostUsd)
                .map(BigDecimal::doubleValue)
                .reduce(0.0, Double::sum)
                : null;

        double averagePrivacyRisk = executedResults.stream()
                .map(TestResult::getPrivacyRiskScore)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);

        int privacyFindings = executedResults.stream()
                .map(TestResult::getPrivacyFlags)
                .filter(Objects::nonNull)
                .mapToInt(List::size)
                .sum();

        List<AssertionResult> assertionResults = results.stream()
                .filter(Objects::nonNull)
                .map(TestResult::getAssertionResults)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .toList();
        int passedAssertions = (int) assertionResults.stream().filter(AssertionResult::passed).count();
        int totalAssertions = assertionResults.size();
        int failedAssertions = totalAssertions - passedAssertions;
        double assertionPassRate = totalAssertions == 0
                ? 0.0
                : (double) passedAssertions / totalAssertions;

        TestRunResponse.MetricsSummary metrics = new TestRunResponse.MetricsSummary();
        metrics.setAverageResponseTimeMs(avgResponseTime);
        metrics.setAverageQualityScore(avgQualityScore);
        metrics.setQualityScoredCases(qualityScoredCases);
        metrics.setQualityCoverage(qualityCoverage);
        metrics.setTotalTokens(totalTokens);
        metrics.setTotalCostUsd(totalCost);
        int completedCases = (int) results.stream()
                .filter(result -> result != null && "COMPLETED".equals(result.getStatus()))
                .count();
        metrics.setCompletedCases(completedCases);
        metrics.setFailedCases(results.size() - completedCases);
        metrics.setAveragePrivacyRiskScore(averagePrivacyRisk);
        metrics.setTotalPrivacyFindings(privacyFindings);
        metrics.setTotalAssertions(totalAssertions);
        metrics.setPassedAssertions(passedAssertions);
        metrics.setFailedAssertions(failedAssertions);
        metrics.setAssertionPassRate(assertionPassRate);
        return metrics;
    }

    private boolean hasCompleteResponseTimeEvidence(List<TestResult> executedResults) {
        return !executedResults.isEmpty()
                && executedResults.stream().allMatch(result -> result.getResponseTimeMs() != null);
    }

    private boolean hasCompleteTokenEvidence(List<TestResult> executedResults) {
        return !executedResults.isEmpty()
                && executedResults.stream().allMatch(result -> result.getTokenCount() != null);
    }

    private boolean hasCompleteCostEvidence(List<TestResult> executedResults) {
        return !executedResults.isEmpty()
                && executedResults.stream().allMatch(result -> result.getCostUsd() != null);
    }

    private TestRunResponse.MetricsSummary createEmptyMetrics() {
        TestRunResponse.MetricsSummary metrics = new TestRunResponse.MetricsSummary();
        metrics.setAverageResponseTimeMs(null);
        metrics.setAverageQualityScore(null);
        metrics.setQualityScoredCases(0);
        metrics.setQualityCoverage(0.0);
        metrics.setTotalTokens(null);
        metrics.setTotalCostUsd(null);
        metrics.setCompletedCases(0);
        metrics.setFailedCases(0);
        metrics.setAveragePrivacyRiskScore(0.0);
        metrics.setTotalPrivacyFindings(0);
        metrics.setTotalAssertions(0);
        metrics.setPassedAssertions(0);
        metrics.setFailedAssertions(0);
        metrics.setAssertionPassRate(0.0);
        return metrics;
    }
}
