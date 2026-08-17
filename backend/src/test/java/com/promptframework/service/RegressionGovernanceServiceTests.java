package com.promptframework.service;

import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.model.dto.AssertionResult;
import com.promptframework.model.dto.AssertionType;
import com.promptframework.model.dto.PromptReadinessRow;
import com.promptframework.model.dto.RegressionGateRequest;
import com.promptframework.model.dto.RegressionGateResponse;
import com.promptframework.model.dto.RegressionGateRules;
import com.promptframework.model.dto.WorkspaceSummaryResponse;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MetricsAssertionFailureTest {

    @Test
    void ignoresAnEmptyPlaceholderWhenCalculatingExecutedEvidence() {
        TestResult placeholder = new TestResult();

        TestResult measured = new TestResult();
        measured.setStatus("COMPLETED");
        measured.setAiResponse("完整执行结果");
        measured.setResponseTimeMs(120);
        measured.setCostUsd(new BigDecimal("0.001"));
        measured.setQualityScore(0.8);

        var metrics = new MetricsService().calculateMetrics(List.of(placeholder, measured));

        assertThat(metrics.getAverageResponseTimeMs()).isEqualTo(120.0);
        assertThat(metrics.getTotalCostUsd()).isEqualTo(0.001);
        assertThat(metrics.getQualityCoverage()).isEqualTo(1.0);
    }

    @Test
    void returnsNoAverageQualityWhenExecutedCasesWereNotScored() {
        TestResult result = new TestResult();
        result.setStatus("COMPLETED");
        result.setAiResponse("模型已经成功返回");

        var metrics = new MetricsService().calculateMetrics(List.of(result));

        assertThat(metrics.getAverageQualityScore()).isNull();
    }

    @Test
    void reportsOnlyScoredCasesInQualityCoverageAndKeepsZeroScore() {
        TestResult unscored = new TestResult();
        unscored.setStatus("COMPLETED");
        unscored.setAiResponse("未取得裁判评分");

        TestResult scored = new TestResult();
        scored.setStatus("COMPLETED");
        scored.setAiResponse("取得了零分");
        scored.setQualityScore(0.0);

        var metrics = new MetricsService().calculateMetrics(List.of(unscored, scored));

        assertThat(metrics.getAverageQualityScore()).isZero();
        assertThat(metrics.getQualityScoredCases()).isEqualTo(1);
        assertThat(metrics.getQualityCoverage()).isEqualTo(0.5);
    }

    @Test
    void returnsUnknownTotalTokensWhenAnyExecutedCaseLacksUsage() {
        TestResult measured = new TestResult();
        measured.setStatus("COMPLETED");
        measured.setAiResponse("带 usage 的响应");
        measured.setTokenCount(12);

        TestResult usageUnknown = new TestResult();
        usageUnknown.setStatus("COMPLETED");
        usageUnknown.setAiResponse("缺少 usage 的响应");

        var metrics = new MetricsService().calculateMetrics(List.of(measured, usageUnknown));

        assertThat(metrics.getTotalTokens()).isNull();
    }

    @Test
    void preservesKnownZeroTokens() {
        TestResult result = new TestResult();
        result.setStatus("COMPLETED");
        result.setAiResponse("已知零 token 的模拟响应");
        result.setTokenCount(0);

        var metrics = new MetricsService().calculateMetrics(List.of(result));

        assertThat(metrics.getTotalTokens()).isZero();
    }

    @Test
    void returnsUnknownTimingAndCostWhenAnyExecutedCaseLacksEvidence() {
        TestResult measured = new TestResult();
        measured.setStatus("COMPLETED");
        measured.setAiResponse("带有计量证据");
        measured.setResponseTimeMs(120);
        measured.setCostUsd(new BigDecimal("0.001"));

        TestResult unmeasured = new TestResult();
        unmeasured.setStatus("COMPLETED");
        unmeasured.setAiResponse("缺少计量证据");

        var metrics = new MetricsService().calculateMetrics(List.of(measured, unmeasured));

        assertThat(metrics.getAverageResponseTimeMs()).isNull();
        assertThat(metrics.getTotalCostUsd()).isNull();
    }

    @Test
    void preservesKnownZeroTimingAndCost() {
        TestResult result = new TestResult();
        result.setStatus("COMPLETED");
        result.setAiResponse("零成本模拟响应");
        result.setResponseTimeMs(0);
        result.setCostUsd(BigDecimal.ZERO);

        var metrics = new MetricsService().calculateMetrics(List.of(result));

        assertThat(metrics.getAverageResponseTimeMs()).isZero();
        assertThat(metrics.getTotalCostUsd()).isZero();
    }

    @Test
    void reportsZeroQualityCoverageForEmptyMetrics() {
        var metrics = new MetricsService().calculateMetrics(List.of());

        assertThat(metrics.getAverageResponseTimeMs()).isNull();
        assertThat(metrics.getAverageQualityScore()).isNull();
        assertThat(metrics.getQualityScoredCases()).isZero();
        assertThat(metrics.getQualityCoverage()).isZero();
        assertThat(metrics.getTotalTokens()).isNull();
        assertThat(metrics.getTotalCostUsd()).isNull();
    }

    @Test
    void keepsGenerationMetricsWhenOnlyTheAssertionFailed() {
        TestResult result = new TestResult();
        result.setStatus("FAILED");
        result.setErrorCode("ASSERTION_FAILED");
        result.setAiResponse("模型已经成功返回");
        result.setResponseTimeMs(320);
        result.setTokenCount(18);
        result.setCostUsd(new BigDecimal("0.0012"));
        result.setQualityScore(0.81);
        result.setAssertionResults(List.of(new AssertionResult(
                AssertionType.CONTAINS,
                false,
                "结论",
                "模型已经成功返回",
                "输出缺少期望文本"
        )));

        var metrics = new MetricsService().calculateMetrics(List.of(result));

        assertThat(metrics.getAverageResponseTimeMs()).isEqualTo(320.0);
        assertThat(metrics.getAverageQualityScore()).isEqualTo(0.81);
        assertThat(metrics.getQualityScoredCases()).isEqualTo(1);
        assertThat(metrics.getQualityCoverage()).isEqualTo(1.0);
        assertThat(metrics.getTotalTokens()).isEqualTo(18);
        assertThat(metrics.getTotalCostUsd()).isEqualTo(0.0012);
        assertThat(metrics.getCompletedCases()).isZero();
        assertThat(metrics.getFailedCases()).isEqualTo(1);
    }
}

class RegressionGateServiceTest {

    private TestRunMapper testRunMapper;
    private TestResultMapper testResultMapper;
    private PromptService promptService;
    private RegressionGateService service;

    @BeforeEach
    void setUp() {
        testRunMapper = mock(TestRunMapper.class);
        testResultMapper = mock(TestResultMapper.class);
        promptService = mock(PromptService.class);
        service = new RegressionGateService(testRunMapper, testResultMapper, promptService);
    }

    @Test
    void passesWhenCandidateStaysWithinDefaultRegressionBudget() {
        stubComparableRuns();
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 100, "0.010", 0.90),
                result("第二例", "COMPLETED", null, 300, "0.020", 0.80)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 110, "0.012", 0.87),
                result("第二例", "COMPLETED", null, 380, "0.024", 0.78)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("PASSED");
        assertThat(response.passed()).isTrue();
        assertThat(response.reasons()).isEmpty();
        assertThat(response.newFailures()).isEmpty();
        assertThat(response.metrics()).extracting(metric -> metric.name())
                .containsExactly("CASE_PASS_RATE", "AVERAGE_QUALITY_SCORE", "QUALITY_COVERAGE", "TOTAL_COST_USD", "AVERAGE_LATENCY_MS");
        assertThat(response.metrics().get(0).baseline()).isEqualTo(1.0);
        assertThat(response.metrics().get(0).candidate()).isEqualTo(1.0);
        assertThat(response.metrics().get(0).limit()).isEqualTo(1.0);
        assertThat(response.metrics().get(1).delta()).isEqualTo(-0.025);
        assertThat(response.metrics().get(1).limit()).isEqualTo(0.03);
        assertThat(response.metrics().get(3).deltaPercent()).isEqualTo(20.0);
        assertThat(response.metrics().get(4).deltaPercent()).isEqualTo(22.5);
        assertThat(response.metrics()).allMatch(metric -> metric.available() && metric.passed());
    }

    @Test
    void reportsEveryRegressedMetricAndNewCaseFailures() {
        stubComparableRuns();
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 100, "0.010", 0.90),
                result("第二例", "COMPLETED", null, 300, "0.020", 0.80)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 200, "0.015", 0.70),
                result("第二例", "FAILED", "ASSERTION_FAILED", 400, "0.030", 0.72)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);
        request.setGates(new RegressionGateRules(0.90, 0.05, 10.0, 20.0));

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.passed()).isFalse();
        assertThat(response.metrics()).filteredOn(metric -> !metric.name().equals("QUALITY_COVERAGE"))
                .allMatch(metric -> metric.available() && !metric.passed());
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("QUALITY_COVERAGE"))
                .singleElement().satisfies(metric -> assertThat(metric.passed()).isTrue());
        assertThat(response.metrics().get(0).candidate()).isEqualTo(0.5);
        assertThat(response.metrics().get(0).deltaPercent()).isEqualTo(-50.0);
        assertThat(response.metrics().get(1).candidate()).isEqualTo(0.71);
        assertThat(response.metrics().get(1).delta()).isEqualTo(-0.14);
        assertThat(response.metrics().get(3).candidate()).isEqualTo(0.045);
        assertThat(response.metrics().get(3).deltaPercent()).isEqualTo(50.0);
        assertThat(response.metrics().get(4).candidate()).isEqualTo(300.0);
        assertThat(response.metrics().get(4).deltaPercent()).isEqualTo(50.0);
        assertThat(response.newFailures()).singleElement().satisfies(failure -> {
            assertThat(failure.index()).isEqualTo(1);
            assertThat(failure.caseName()).isEqualTo("第二例");
            assertThat(failure.errorCode()).isEqualTo("ASSERTION_FAILED");
        });
    }

    @Test
    void marksComparisonIncomparableWhenBaselineEvidenceIsMissing() {
        stubComparableRuns();
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 100, "0.010", null)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 110, "0.011", 0.90)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("INCOMPARABLE");
        assertThat(response.passed()).isFalse();
        assertThat(response.reasons()).contains("BASELINE_AVERAGE_QUALITY_SCORE_UNAVAILABLE");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("AVERAGE_QUALITY_SCORE"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.available()).isFalse();
                    assertThat(metric.passed()).isFalse();
                    assertThat(metric.baseline()).isNull();
                });
    }

    @Test
    void marksCandidateEvidenceLossAsRegression() {
        stubComparableRuns();
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 100, "0.010", 0.90)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 110, null, 0.91)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.reasons()).contains("CANDIDATE_TOTAL_COST_USD_UNAVAILABLE");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("TOTAL_COST_USD"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.available()).isFalse();
                    assertThat(metric.passed()).isFalse();
                    assertThat(metric.baseline()).isEqualTo(0.01);
                    assertThat(metric.candidate()).isNull();
                });
    }

    @Test
    void handlesZeroBaselineWithoutSerializingInfinity() {
        stubComparableRuns();
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 0, "0", 0.90)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("第一例", "COMPLETED", null, 1, "0.001", 0.90)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("TOTAL_COST_USD"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.deltaPercent()).isNull();
                    assertThat(metric.available()).isTrue();
                    assertThat(metric.passed()).isFalse();
                });
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("AVERAGE_LATENCY_MS"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.deltaPercent()).isNull();
                    assertThat(metric.available()).isTrue();
                    assertThat(metric.passed()).isFalse();
                });
    }

    @Test
    void returnsStructuralReasonsInsteadOfComparingDifferentDatasets() {
        TestRun baseline = run(1L, 11L, "COMPLETED", "dataset-a");
        TestRun candidate = run(2L, 12L, "RUNNING", "dataset-b");
        when(testRunMapper.findById(1L)).thenReturn(baseline);
        when(testRunMapper.findById(2L)).thenReturn(candidate);
        when(promptService.getVersion(11L)).thenReturn(version(11L, 101L));
        when(promptService.getVersion(12L)).thenReturn(version(12L, 202L));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("INCOMPARABLE");
        assertThat(response.reasons()).contains("CANDIDATE_RUN_NOT_TERMINAL", "DIFFERENT_PROMPTS", "DATASET_FINGERPRINT_MISMATCH");
        assertThat(response.metrics()).isEmpty();
    }

    private void stubComparableRuns() {
        when(testRunMapper.findById(1L)).thenReturn(run(1L, 11L, "COMPLETED", "same-dataset"));
        when(testRunMapper.findById(2L)).thenReturn(run(2L, 12L, "COMPLETED", "same-dataset"));
        when(promptService.getVersion(11L)).thenReturn(version(11L, 101L));
        when(promptService.getVersion(12L)).thenReturn(version(12L, 101L));
    }

    private TestRun run(long id, long versionId, String status, String fingerprint) {
        TestRun run = new TestRun();
        run.setId(id);
        run.setPromptVersionId(versionId);
        run.setStatus(status);
        run.setDatasetFingerprint(fingerprint);
        return run;
    }

    private PromptVersion version(long id, long promptId) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(promptId);
        return version;
    }

    private TestResult result(
            String caseName,
            String status,
            String errorCode,
            Integer latencyMs,
            String costUsd,
            Double qualityScore) {
        TestResult result = new TestResult();
        result.setCaseName(caseName);
        result.setStatus(status);
        result.setErrorCode(errorCode);
        result.setAiResponse("executed");
        result.setResponseTimeMs(latencyMs);
        result.setCostUsd(costUsd == null ? null : new BigDecimal(costUsd));
        result.setQualityScore(qualityScore);
        return result;
    }
}

class RegressionGateReviewFindingsTest {

    private TestRunMapper testRunMapper;
    private TestResultMapper testResultMapper;
    private PromptService promptService;
    private RegressionGateService service;

    @BeforeEach
    void setUp() {
        testRunMapper = mock(TestRunMapper.class);
        testResultMapper = mock(TestResultMapper.class);
        promptService = mock(PromptService.class);
        service = new RegressionGateService(testRunMapper, testResultMapper, promptService);
    }

    @Test
    void failsGateWhenFailureMovesToANewCaseButPassRateStaysEqual() {
        stubRuns("COMPLETED", "COMPLETED");
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("A", "COMPLETED", null, "answer-a", 0.90),
                result("B", "FAILED", "ASSERTION_FAILED", "answer-b", 0.90)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("A", "FAILED", "PROVIDER_EXECUTION_FAILED", "answer-a2", 0.90),
                result("B", "COMPLETED", null, "answer-b2", 0.90)));

        RegressionGateResponse response = service.evaluate(2L, requestWithMinPassRate(0.50));

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.passed()).isFalse();
        assertThat(response.reasons()).contains("NEW_CASE_FAILURES");
        assertThat(response.metrics()).allMatch(metric -> metric.passed());
        assertThat(response.newFailures()).singleElement().satisfies(failure -> {
            assertThat(failure.index()).isZero();
            assertThat(failure.caseName()).isEqualTo("A");
            assertThat(failure.errorCode()).isEqualTo("PROVIDER_EXECUTION_FAILED");
        });
    }

    @Test
    void regressesWhenCandidateLosesQualityCoverageWithoutChangingAverageScore() {
        stubRuns("COMPLETED", "COMPLETED");
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("A", "COMPLETED", null, "answer-a", 0.90),
                result("B", "COMPLETED", null, "answer-b", 0.90)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("A", "COMPLETED", null, "answer-a2", 0.90),
                result("B", "COMPLETED", null, "answer-b2", null)));

        RegressionGateResponse response = service.evaluate(2L, requestWithMinPassRate(1.0));

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.reasons()).contains("QUALITY_COVERAGE_BELOW_BASELINE");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("QUALITY_COVERAGE"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.baseline()).isEqualTo(1.0);
                    assertThat(metric.candidate()).isEqualTo(0.5);
                    assertThat(metric.delta()).isEqualTo(-0.5);
                    assertThat(metric.deltaPercent()).isEqualTo(-50.0);
                    assertThat(metric.limit()).isEqualTo(1.0);
                    assertThat(metric.available()).isTrue();
                    assertThat(metric.passed()).isFalse();
                });
    }

    @Test
    void marksBaselineQualityCoverageIncomparableWhenNoCaseWasExecuted() {
        stubRuns("FAILED", "COMPLETED");
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("A", "FAILED", "PROVIDER_EXECUTION_FAILED", null, null)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("A", "COMPLETED", null, "answer", 0.90)));

        RegressionGateResponse response = service.evaluate(2L, requestWithMinPassRate(0.0));

        assertThat(response.verdict()).isEqualTo("INCOMPARABLE");
        assertThat(response.reasons()).contains("BASELINE_QUALITY_COVERAGE_UNAVAILABLE");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("QUALITY_COVERAGE"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.baseline()).isNull();
                    assertThat(metric.candidate()).isEqualTo(1.0);
                    assertThat(metric.available()).isFalse();
                    assertThat(metric.passed()).isFalse();
                });
    }

    @Test
    void rejectsAnyNonTerminalRunStatusBeforeMetricComparison() {
        stubRuns("QUEUED", "CANCELLED");

        RegressionGateResponse response = service.evaluate(2L, requestWithMinPassRate(0.0));

        assertThat(response.verdict()).isEqualTo("INCOMPARABLE");
        assertThat(response.reasons()).containsExactly(
                "BASELINE_RUN_NOT_TERMINAL",
                "CANDIDATE_RUN_NOT_TERMINAL");
        assertThat(response.metrics()).isEmpty();
    }

    @Test
    void preservesStableMapperOrderWhenReportingMultipleNewFailures() {
        stubRuns("COMPLETED", "COMPLETED");
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                result("A", "COMPLETED", null, "answer-a", 0.90),
                result("B", "COMPLETED", null, "answer-b", 0.90),
                result("C", "COMPLETED", null, "answer-c", 0.90)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                result("A", "FAILED", "ERROR_A", "answer-a2", 0.90),
                result("B", "COMPLETED", null, "answer-b2", 0.90),
                result("C", "FAILED", "ERROR_C", "answer-c2", 0.90)));

        RegressionGateResponse response = service.evaluate(2L, requestWithMinPassRate(0.0));

        assertThat(response.newFailures())
                .extracting(failure -> failure.index() + ":" + failure.caseName() + ":" + failure.errorCode())
                .containsExactly("0:A:ERROR_A", "2:C:ERROR_C");
    }

    private void stubRuns(String baselineStatus, String candidateStatus) {
        when(testRunMapper.findById(1L)).thenReturn(run(1L, 11L, baselineStatus));
        when(testRunMapper.findById(2L)).thenReturn(run(2L, 12L, candidateStatus));
        when(promptService.getVersion(11L)).thenReturn(version(11L));
        when(promptService.getVersion(12L)).thenReturn(version(12L));
    }

    private RegressionGateRequest requestWithMinPassRate(double minPassRate) {
        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);
        request.setGates(new RegressionGateRules(minPassRate, 0.03, 20.0, 25.0));
        return request;
    }

    private TestRun run(long id, long versionId, String status) {
        TestRun run = new TestRun();
        run.setId(id);
        run.setPromptVersionId(versionId);
        run.setStatus(status);
        run.setDatasetFingerprint("same-dataset");
        return run;
    }

    private PromptVersion version(long id) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(101L);
        return version;
    }

    private TestResult result(
            String caseName,
            String status,
            String errorCode,
            String aiResponse,
            Double qualityScore) {
        TestResult result = new TestResult();
        result.setCaseName(caseName);
        result.setStatus(status);
        result.setErrorCode(errorCode);
        result.setAiResponse(aiResponse);
        result.setResponseTimeMs(100);
        result.setCostUsd(new BigDecimal("0.01"));
        result.setQualityScore(qualityScore);
        return result;
    }
}

class RegressionGateCompletedEvidenceIntegrityTest {

    @Test
    void neverPassesCompletedCandidateCaseWhoseExecutionEvidenceIsMissing() {
        TestRunMapper runs = mock(TestRunMapper.class);
        TestResultMapper results = mock(TestResultMapper.class);
        PromptService prompts = mock(PromptService.class);
        RegressionGateService service = new RegressionGateService(runs, results, prompts);
        when(runs.findById(1L)).thenReturn(run(1L, 11L));
        when(runs.findById(2L)).thenReturn(run(2L, 12L));
        when(prompts.getVersion(11L)).thenReturn(version(11L));
        when(prompts.getVersion(12L)).thenReturn(version(12L));
        when(results.findByTestRunId(1L)).thenReturn(List.of(
                completed("A", "baseline-a", "0.005", 100, 0.90),
                completed("B", "baseline-b", "0.005", 100, 0.90)));
        when(results.findByTestRunId(2L)).thenReturn(List.of(
                completed("A", "candidate-a", "0.010", 100, 0.90),
                completed("B", null, null, null, null)));

        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);

        RegressionGateResponse response = service.evaluate(2L, request);

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.passed()).isFalse();
        assertThat(response.reasons()).contains(
                "QUALITY_COVERAGE_BELOW_BASELINE",
                "CANDIDATE_TOTAL_COST_USD_UNAVAILABLE",
                "CANDIDATE_AVERAGE_LATENCY_MS_UNAVAILABLE");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("QUALITY_COVERAGE"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.baseline()).isEqualTo(1.0);
                    assertThat(metric.candidate()).isEqualTo(0.5);
                    assertThat(metric.passed()).isFalse();
                });
    }

    private TestRun run(long id, long versionId) {
        TestRun run = new TestRun();
        run.setId(id);
        run.setPromptVersionId(versionId);
        run.setStatus("COMPLETED");
        run.setDatasetFingerprint("same-dataset");
        return run;
    }

    private PromptVersion version(long id) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(101L);
        return version;
    }

    private TestResult completed(
            String caseName,
            String aiResponse,
            String costUsd,
            Integer latencyMs,
            Double qualityScore) {
        TestResult result = new TestResult();
        result.setCaseName(caseName);
        result.setStatus("COMPLETED");
        result.setAiResponse(aiResponse);
        result.setCostUsd(costUsd == null ? null : new BigDecimal(costUsd));
        result.setResponseTimeMs(latencyMs);
        result.setQualityScore(qualityScore);
        return result;
    }
}

class RegressionGateExecutedEvidenceTest {

    private TestRunMapper testRunMapper;
    private TestResultMapper testResultMapper;
    private PromptService promptService;
    private RegressionGateService service;

    @BeforeEach
    void setUp() {
        testRunMapper = mock(TestRunMapper.class);
        testResultMapper = mock(TestResultMapper.class);
        promptService = mock(PromptService.class);
        service = new RegressionGateService(testRunMapper, testResultMapper, promptService);
        stubComparableRuns();
    }

    @Test
    void ignoresUnexecutedCasesWhenComputingCostAndLatencyEvidence() {
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                invalidCase("invalid"),
                executedCase("executed", "0.010", 100)));
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                invalidCase("invalid"),
                executedCase("executed", "0.011", 110)));

        RegressionGateResponse response = service.evaluate(2L, request());

        assertThat(response.verdict()).isEqualTo("PASSED");
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("TOTAL_COST_USD"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.baseline()).isEqualTo(0.01);
                    assertThat(metric.candidate()).isEqualTo(0.011);
                    assertThat(metric.deltaPercent()).isEqualTo(10.0);
                    assertThat(metric.available()).isTrue();
                    assertThat(metric.passed()).isTrue();
                });
        assertThat(response.metrics()).filteredOn(metric -> metric.name().equals("AVERAGE_LATENCY_MS"))
                .singleElement().satisfies(metric -> {
                    assertThat(metric.baseline()).isEqualTo(100.0);
                    assertThat(metric.candidate()).isEqualTo(110.0);
                    assertThat(metric.deltaPercent()).isEqualTo(10.0);
                    assertThat(metric.available()).isTrue();
                    assertThat(metric.passed()).isTrue();
                });
    }

    @Test
    void marksEvidenceUnavailableWhenAnExecutedCaseLacksMeasurements() {
        when(testResultMapper.findByTestRunId(1L)).thenReturn(List.of(
                invalidCase("invalid"),
                executedCase("executed", "0.010", 100)));
        TestResult candidateExecuted = executedCase("executed", null, null);
        when(testResultMapper.findByTestRunId(2L)).thenReturn(List.of(
                invalidCase("invalid"),
                candidateExecuted));

        RegressionGateResponse response = service.evaluate(2L, request());

        assertThat(response.verdict()).isEqualTo("REGRESSED");
        assertThat(response.reasons()).contains(
                "CANDIDATE_TOTAL_COST_USD_UNAVAILABLE",
                "CANDIDATE_AVERAGE_LATENCY_MS_UNAVAILABLE");
    }

    private void stubComparableRuns() {
        when(testRunMapper.findById(1L)).thenReturn(run(1L, 11L));
        when(testRunMapper.findById(2L)).thenReturn(run(2L, 12L));
        when(promptService.getVersion(11L)).thenReturn(version(11L));
        when(promptService.getVersion(12L)).thenReturn(version(12L));
    }

    private RegressionGateRequest request() {
        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);
        request.setGates(new RegressionGateRules(0.5, 0.03, 20.0, 25.0));
        return request;
    }

    private TestRun run(long id, long versionId) {
        TestRun run = new TestRun();
        run.setId(id);
        run.setPromptVersionId(versionId);
        run.setStatus("COMPLETED");
        run.setDatasetFingerprint("same-dataset");
        return run;
    }

    private PromptVersion version(long id) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(101L);
        return version;
    }

    private TestResult invalidCase(String name) {
        TestResult result = new TestResult();
        result.setCaseName(name);
        result.setStatus("FAILED");
        result.setErrorCode("INVALID_TEST_CASE");
        return result;
    }

    private TestResult executedCase(String name, String costUsd, Integer latencyMs) {
        TestResult result = new TestResult();
        result.setCaseName(name);
        result.setStatus("COMPLETED");
        result.setAiResponse("answer");
        result.setQualityScore(0.90);
        result.setCostUsd(costUsd == null ? null : new BigDecimal(costUsd));
        result.setResponseTimeMs(latencyMs);
        return result;
    }
}

class WorkspaceDashboardServiceTest {

    private final LocalDateTime now = LocalDateTime.of(2026, 7, 9, 12, 0);

    private final Clock clock = Clock.fixed(now.toInstant(ZoneOffset.UTC), ZoneOffset.UTC);
    @Test
    void classifiesPromptReadinessStates() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null, clock);

        assertThat(service.classifyPromptReadiness(prompt(1L, "No version", "owner", now), List.of(), now, now).level())
                .isEqualTo("blocked");

        assertThat(service.classifyPromptReadiness(
                prompt(2L, "Missing context", "", now),
                List.of(version(21L, 2L, 1, now.minusDays(1))),
                now.minusDays(1),
                now
        ).label()).isEqualTo("Needs owner context");

        assertThat(service.classifyPromptReadiness(
                prompt(3L, "No challenger", "owned", now),
                List.of(version(31L, 3L, 1, now.minusDays(1))),
                now.minusDays(1),
                now
        ).label()).isEqualTo("Needs challenger");

        assertThat(service.classifyPromptReadiness(
                prompt(4L, "Stale", "owned", now.minusDays(30)),
                List.of(
                        version(41L, 4L, 1, now.minusDays(30)),
                        version(42L, 4L, 2, now.minusDays(20))
                ),
                now.minusDays(20),
                now
        ).level()).isEqualTo("watch");

        assertThat(service.classifyPromptReadiness(
                prompt(5L, "Ready", "owned", now.minusDays(3)),
                List.of(
                        version(51L, 5L, 1, now.minusDays(3)),
                        version(52L, 5L, 2, now.minusDays(1))
                ),
                now.minusDays(1),
                now
        ).level()).isEqualTo("ready");
    }

    @Test
    void summarizesWorkspaceForDashboardAndGovernanceQueue() {
        Prompt ready = prompt(1L, "Ready", "owned", now.minusDays(3));
        Prompt needsContext = prompt(2L, "Needs context", "", now.minusDays(2));
        Prompt blocked = prompt(3L, "Blocked", "owned", now.minusDays(4));

        PromptMapper promptMapper = new InMemoryPromptMapper(List.of(ready, needsContext, blocked));
        PromptVersionMapper versionMapper = new InMemoryPromptVersionMapper(Map.of(
                1L, List.of(version(11L, 1L, 1, now.minusDays(3)), version(12L, 1L, 2, now.minusDays(1))),
                2L, List.of(version(21L, 2L, 1, now.minusDays(2))),
                3L, List.of()
        ));

        WorkspaceSummaryResponse summary = new WorkspaceDashboardService(promptMapper, versionMapper, clock).getWorkspaceSummary();

        assertThat(summary.totalPrompts()).isEqualTo(3);
        assertThat(summary.totalVersions()).isEqualTo(3);
        assertThat(summary.averageVersions()).isEqualTo(1.0);
        assertThat(summary.readyCount()).isEqualTo(1);
        assertThat(summary.attentionCount()).isEqualTo(2);
        assertThat(summary.readinessScore()).isEqualTo(33);
        assertThat(summary.challengerCoverage()).isEqualTo(33);
        assertThat(summary.releaseGovernance().schema()).isEqualTo("PromptOps.ReleaseGovernance.v1");
        assertThat(summary.releaseGovernance().releaseDecision()).isEqualTo("blocked");
        assertThat(summary.releaseGovernance().publishableCount()).isEqualTo(1);
        assertThat(summary.releaseGovernance().blockedCount()).isEqualTo(2);
        assertThat(summary.releaseGovernance().blockers())
                .extracting(blocker -> blocker.code())
                .containsExactly("PROMPT_NEEDS_REVIEW", "PROMPT_BLOCKED");
        assertThat(summary.releaseGovernance().verificationCommands())
                .contains("cd frontend && npm run test:all");
        assertThat(summary.auditEvidence().schema()).isEqualTo("PromptOps.AuditEvidence.v1");
        assertThat(summary.auditEvidence().artifactId()).startsWith("promptops-workspace-");
        assertThat(summary.auditEvidence().governedPromptCount()).isEqualTo(3);
        assertThat(summary.auditEvidence().evidenceItems())
                .contains("prompt identity and owner context", "readiness classification and reason");
        assertThat(summary.auditEvidence().riskDisclosure()).contains("does not replace model safety");
        assertThat(summary.rows()).extracting(PromptReadinessRow::name)
                .containsExactly("Ready", "Needs context", "Blocked");
    }

    @Test
    void buildsAuditEvidenceForReleaseReviewExport() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null, clock);
        PromptReadinessRow ready = service.toReadinessRow(
                prompt(7L, "Ready", "owned", now.minusDays(2)),
                List.of(
                        version(71L, 7L, 1, now.minusDays(2)),
                        version(72L, 7L, 2, now.minusDays(1))
                ),
                now
        );
        PromptReadinessRow blocked = service.toReadinessRow(
                prompt(8L, "Blocked", "owned", now.minusDays(1)),
                List.of(),
                now
        );

        var evidence = service.buildAuditEvidence(List.of(ready, blocked), now);

        assertThat(evidence.schema()).isEqualTo("PromptOps.AuditEvidence.v1");
        assertThat(evidence.generatedAt()).isEqualTo("2026-07-09T12:00Z");
        assertThat(evidence.governedPromptCount()).isEqualTo(2);
        assertThat(evidence.evidenceItemCount()).isEqualTo(9);
        assertThat(evidence.controlOwners()).contains("PromptOps reviewer", "Release manager");
        assertThat(evidence.exportFormats()).contains("workspace summary API JSON", "audit evidence JSON");
    }

    @Test
    void buildsApprovedReleaseGovernanceWhenAllPromptsAreReady() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null, clock);
        PromptReadinessRow row = service.toReadinessRow(
                prompt(7L, "Ready", "owned", now.minusDays(2)),
                List.of(
                        version(71L, 7L, 1, now.minusDays(2)),
                        version(72L, 7L, 2, now.minusDays(1))
                ),
                now
        );

        var governance = service.buildReleaseGovernance(List.of(row));

        assertThat(governance.releaseDecision()).isEqualTo("approved");
        assertThat(governance.publishableCount()).isEqualTo(1);
        assertThat(governance.blockedCount()).isZero();
        assertThat(governance.blockers()).isEmpty();
        assertThat(governance.riskDisclosure()).contains("controlled rollout");
    }

    private static Prompt prompt(Long id, String name, String description, LocalDateTime createdAt) {
        Prompt prompt = new Prompt();
        prompt.setId(id);
        prompt.setName(name);
        prompt.setDescription(description);
        prompt.setCreatedAt(createdAt);
        prompt.setUpdatedAt(createdAt);
        return prompt;
    }

    private static PromptVersion version(Long id, Long promptId, int versionNumber, LocalDateTime createdAt) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(promptId);
        version.setVersionNumber(versionNumber);
        version.setContent("version " + versionNumber);
        version.setCreatedAt(createdAt);
        return version;
    }

    private record InMemoryPromptMapper(List<Prompt> prompts) implements PromptMapper {
        @Override
        public void insert(Prompt prompt) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Prompt findById(Long id) {
            return prompts.stream().filter(prompt -> prompt.getId().equals(id)).findFirst().orElse(null);
        }

        @Override
        public Prompt findByIdForUpdate(Long id) {
            return findById(id);
        }

        @Override
        public List<Prompt> findAll() {
            return new ArrayList<>(prompts);
        }

        @Override
        public void update(Prompt prompt) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteById(Long id) {
            throw new UnsupportedOperationException();
        }
    }

    private record InMemoryPromptVersionMapper(Map<Long, List<PromptVersion>> versions) implements PromptVersionMapper {
        @Override
        public void insert(PromptVersion promptVersion) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PromptVersion findById(Long id) {
            return versions.values().stream()
                    .flatMap(List::stream)
                    .filter(version -> version.getId().equals(id))
                    .findFirst()
                    .orElse(null);
        }

        @Override
        public List<PromptVersion> findByPromptId(Long promptId) {
            return versions.getOrDefault(promptId, List.of());
        }

        @Override
        public PromptVersion findLatestByPromptId(Long promptId) {
            return findByPromptId(promptId).stream()
                    .max((left, right) -> left.getVersionNumber().compareTo(right.getVersionNumber()))
                    .orElse(null);
        }

        @Override
        public Integer getNextVersionNumber(Long promptId) {
            return findByPromptId(promptId).size() + 1;
        }
    }
}
