package com.promptframework.service;

import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.model.dto.RegressionGateFailure;
import com.promptframework.model.dto.RegressionGateMetric;
import com.promptframework.model.dto.RegressionGateRequest;
import com.promptframework.model.dto.RegressionGateResponse;
import com.promptframework.model.dto.RegressionGateRules;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RegressionGateService {

    private static final Set<String> TERMINAL_RUN_STATUSES = Set.of("COMPLETED", "PARTIAL", "FAILED");
    private static final String CASE_PASS_RATE = "CASE_PASS_RATE";
    private static final String AVERAGE_QUALITY_SCORE = "AVERAGE_QUALITY_SCORE";
    private static final String QUALITY_COVERAGE = "QUALITY_COVERAGE";
    private static final String TOTAL_COST_USD = "TOTAL_COST_USD";
    private static final String AVERAGE_LATENCY_MS = "AVERAGE_LATENCY_MS";

    private final TestRunMapper testRunMapper;
    private final TestResultMapper testResultMapper;
    private final PromptService promptService;

    @Transactional(readOnly = true)
    public RegressionGateResponse evaluate(Long candidateRunId, RegressionGateRequest request) {
        Long baselineRunId = request.getBaselineRunId();
        TestRun baseline = requireRun(baselineRunId);
        TestRun candidate = requireRun(candidateRunId);

        List<String> structuralReasons = structuralReasons(baseline, candidate);
        if (!structuralReasons.isEmpty()) {
            return response(baselineRunId, candidateRunId, "INCOMPARABLE", false,
                    structuralReasons, List.of(), List.of());
        }

        List<TestResult> baselineResults = testResultMapper.findByTestRunId(baselineRunId);
        List<TestResult> candidateResults = testResultMapper.findByTestRunId(candidateRunId);
        List<String> resultShapeReasons = new ArrayList<>();
        addResultShapeReasons(resultShapeReasons, baselineResults, candidateResults);
        if (!resultShapeReasons.isEmpty()) {
            return response(baselineRunId, candidateRunId, "INCOMPARABLE", false,
                    resultShapeReasons, List.of(), List.of());
        }

        RegressionGateRules rules = request.getGates() == null ? new RegressionGateRules() : request.getGates();
        List<String> reasons = new ArrayList<>();
        List<RegressionGateMetric> metrics = new ArrayList<>();

        double baselinePassRate = passRate(baselineResults);
        double candidatePassRate = passRate(candidateResults);
        metrics.add(metric(CASE_PASS_RATE, baselinePassRate, candidatePassRate,
                rules.getMinCasePassRate(), candidatePassRate >= rules.getMinCasePassRate(), reasons,
                "CASE_PASS_RATE_BELOW_LIMIT"));

        OptionalDouble baselineQuality = averageQuality(baselineResults);
        OptionalDouble candidateQuality = averageQuality(candidateResults);
        metrics.add(evidenceMetric(AVERAGE_QUALITY_SCORE, baselineQuality, candidateQuality,
                rules.getMaxQualityScoreDrop(), reasons,
                (baselineValue, candidateValue) -> baselineValue - candidateValue <= rules.getMaxQualityScoreDrop(),
                "AVERAGE_QUALITY_SCORE_DROP_EXCEEDED"));

        OptionalDouble baselineQualityCoverage = qualityCoverage(baselineResults);
        OptionalDouble candidateQualityCoverage = qualityCoverage(candidateResults);
        Double qualityCoverageLimit = baselineQualityCoverage.isPresent()
                ? rounded(baselineQualityCoverage.getAsDouble())
                : null;
        metrics.add(evidenceMetric(QUALITY_COVERAGE, baselineQualityCoverage, candidateQualityCoverage,
                qualityCoverageLimit, reasons,
                (baselineValue, candidateValue) -> candidateValue >= baselineValue,
                "QUALITY_COVERAGE_BELOW_BASELINE"));

        OptionalDouble baselineCost = totalCost(baselineResults);
        OptionalDouble candidateCost = totalCost(candidateResults);
        metrics.add(evidenceMetric(TOTAL_COST_USD, baselineCost, candidateCost,
                rules.getMaxCostIncreasePercent(), reasons,
                (baselineValue, candidateValue) -> percentageIncreaseWithin(
                        baselineValue, candidateValue, rules.getMaxCostIncreasePercent()),
                "TOTAL_COST_INCREASE_EXCEEDED"));

        OptionalDouble baselineLatency = averageLatency(baselineResults);
        OptionalDouble candidateLatency = averageLatency(candidateResults);
        metrics.add(evidenceMetric(AVERAGE_LATENCY_MS, baselineLatency, candidateLatency,
                rules.getMaxLatencyIncreasePercent(), reasons,
                (baselineValue, candidateValue) -> percentageIncreaseWithin(
                        baselineValue, candidateValue, rules.getMaxLatencyIncreasePercent()),
                "AVERAGE_LATENCY_INCREASE_EXCEEDED"));

        List<RegressionGateFailure> newFailures = newFailures(baselineResults, candidateResults);
        if (!newFailures.isEmpty()) {
            reasons.add("NEW_CASE_FAILURES");
        }
        boolean baselineEvidenceMissing = metrics.stream().anyMatch(metric -> metric.baseline() == null);
        boolean allPassed = metrics.stream().allMatch(RegressionGateMetric::passed) && newFailures.isEmpty();
        String verdict = baselineEvidenceMissing ? "INCOMPARABLE" : allPassed ? "PASSED" : "REGRESSED";
        return response(baselineRunId, candidateRunId, verdict, "PASSED".equals(verdict),
                reasons, metrics, newFailures);
    }

    private TestRun requireRun(Long runId) {
        TestRun run = testRunMapper.findById(runId);
        if (run == null) {
            throw new ResourceNotFoundException("TestRun", runId);
        }
        return run;
    }

    private List<String> structuralReasons(TestRun baseline, TestRun candidate) {
        List<String> reasons = new ArrayList<>();
        if (Objects.equals(baseline.getId(), candidate.getId())) {
            reasons.add("SAME_RUN");
        }
        if (!isTerminal(baseline.getStatus())) {
            reasons.add("BASELINE_RUN_NOT_TERMINAL");
        }
        if (!isTerminal(candidate.getStatus())) {
            reasons.add("CANDIDATE_RUN_NOT_TERMINAL");
        }

        PromptVersion baselineVersion = promptService.getVersion(baseline.getPromptVersionId());
        PromptVersion candidateVersion = promptService.getVersion(candidate.getPromptVersionId());
        if (!Objects.equals(baselineVersion.getPromptId(), candidateVersion.getPromptId())) {
            reasons.add("DIFFERENT_PROMPTS");
        }

        String baselineFingerprint = baseline.getDatasetFingerprint();
        String candidateFingerprint = candidate.getDatasetFingerprint();
        if (isBlank(baselineFingerprint) || isBlank(candidateFingerprint)) {
            reasons.add("DATASET_FINGERPRINT_MISSING");
        } else if (!baselineFingerprint.equals(candidateFingerprint)) {
            reasons.add("DATASET_FINGERPRINT_MISMATCH");
        }
        return reasons;
    }

    private void addResultShapeReasons(
            List<String> reasons,
            List<TestResult> baselineResults,
            List<TestResult> candidateResults) {
        if (baselineResults == null || baselineResults.isEmpty()) {
            reasons.add("BASELINE_RESULTS_EMPTY");
        }
        if (candidateResults == null || candidateResults.isEmpty()) {
            reasons.add("CANDIDATE_RESULTS_EMPTY");
        }
        if (baselineResults != null && candidateResults != null
                && baselineResults.size() != candidateResults.size()) {
            reasons.add("RESULT_COUNT_MISMATCH");
        }
    }

    private RegressionGateMetric evidenceMetric(
            String name,
            OptionalDouble baseline,
            OptionalDouble candidate,
            Double limit,
            List<String> reasons,
            MetricRule rule,
            String failedReason) {
        if (baseline.isEmpty()) {
            reasons.add("BASELINE_" + name + "_UNAVAILABLE");
            return new RegressionGateMetric(name, null,
                    candidate.isPresent() ? rounded(candidate.getAsDouble()) : null,
                    null, null, limit, false, false);
        }
        if (candidate.isEmpty()) {
            reasons.add("CANDIDATE_" + name + "_UNAVAILABLE");
            return new RegressionGateMetric(name, rounded(baseline.getAsDouble()), null,
                    null, null, limit, false, false);
        }
        boolean passed = rule.passes(baseline.getAsDouble(), candidate.getAsDouble());
        return metric(name, baseline.getAsDouble(), candidate.getAsDouble(), limit, passed, reasons, failedReason);
    }

    private RegressionGateMetric metric(
            String name,
            double baseline,
            double candidate,
            Double limit,
            boolean passed,
            List<String> reasons,
            String failedReason) {
        if (!passed) {
            reasons.add(failedReason);
        }
        return new RegressionGateMetric(
                name,
                rounded(baseline),
                rounded(candidate),
                rounded(candidate - baseline),
                deltaPercent(baseline, candidate),
                limit,
                true,
                passed);
    }

    private double passRate(List<TestResult> results) {
        long completed = results.stream().filter(result -> "COMPLETED".equals(result.getStatus())).count();
        return (double) completed / results.size();
    }

    private OptionalDouble averageQuality(List<TestResult> results) {
        // 缺失的质量分不按 0 计入平均值；全部缺失时保留“证据不可用”语义。
        return results.stream()
                .filter(this::isExecuted)
                .map(TestResult::getQualityScore)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average();
    }

    private OptionalDouble qualityCoverage(List<TestResult> results) {
        long executed = results.stream().filter(this::isExecuted).count();
        if (executed == 0) {
            return OptionalDouble.empty();
        }
        long qualityScored = results.stream()
                .filter(result -> isExecuted(result) && result.getQualityScore() != null)
                .count();
        return OptionalDouble.of((double) qualityScored / executed);
    }

    private OptionalDouble totalCost(List<TestResult> results) {
        List<TestResult> executed = results.stream().filter(this::isExecuted).toList();
        if (executed.isEmpty() || executed.stream().anyMatch(result -> result.getCostUsd() == null)) {
            return OptionalDouble.empty();
        }
        BigDecimal total = executed.stream()
                .map(TestResult::getCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return OptionalDouble.of(total.doubleValue());
    }

    private OptionalDouble averageLatency(List<TestResult> results) {
        List<TestResult> executed = results.stream().filter(this::isExecuted).toList();
        if (executed.isEmpty() || executed.stream().anyMatch(result -> result.getResponseTimeMs() == null)) {
            return OptionalDouble.empty();
        }
        return executed.stream().mapToInt(TestResult::getResponseTimeMs).average();
    }

    private boolean percentageIncreaseWithin(double baseline, double candidate, double limit) {
        // 零基线不能产生 Infinity；只有候选也为零时才视为没有增长。
        if (baseline == 0.0) {
            return candidate == 0.0;
        }
        return ((candidate - baseline) / baseline) * 100.0 <= limit;
    }

    private Double deltaPercent(double baseline, double candidate) {
        if (baseline == 0.0) {
            return candidate == 0.0 ? 0.0 : null;
        }
        return rounded(((candidate - baseline) / baseline) * 100.0);
    }

    private List<RegressionGateFailure> newFailures(
            List<TestResult> baselineResults,
            List<TestResult> candidateResults) {
        List<RegressionGateFailure> failures = new ArrayList<>();
        for (int index = 0; index < baselineResults.size(); index++) {
            TestResult baseline = baselineResults.get(index);
            TestResult candidate = candidateResults.get(index);
            if ("COMPLETED".equals(baseline.getStatus()) && !"COMPLETED".equals(candidate.getStatus())) {
                String caseName = candidate.getCaseName() == null ? baseline.getCaseName() : candidate.getCaseName();
                failures.add(new RegressionGateFailure(index, caseName, candidate.getErrorCode()));
            }
        }
        return List.copyOf(failures);
    }

    private RegressionGateResponse response(
            Long baselineRunId,
            Long candidateRunId,
            String verdict,
            boolean passed,
            List<String> reasons,
            List<RegressionGateMetric> metrics,
            List<RegressionGateFailure> failures) {
        return new RegressionGateResponse(
                baselineRunId,
                candidateRunId,
                verdict,
                passed,
                List.copyOf(reasons),
                List.copyOf(metrics),
                List.copyOf(failures));
    }

    private boolean isExecuted(TestResult result) {
        // 与 MetricsService 保持一致：历史 COMPLETED 行即使输出缺失，也必须进入证据完整性检查。
        return result.getAiResponse() != null || "COMPLETED".equals(result.getStatus());
    }

    private boolean isTerminal(String status) {
        return status != null && TERMINAL_RUN_STATUSES.contains(status);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private double rounded(double value) {
        return BigDecimal.valueOf(value).setScale(12, RoundingMode.HALF_UP).stripTrailingZeros().doubleValue();
    }

    @FunctionalInterface
    private interface MetricRule {
        boolean passes(double baseline, double candidate);
    }
}
