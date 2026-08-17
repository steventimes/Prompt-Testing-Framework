package com.promptframework.service;

import com.promptframework.exception.PromptExecutionException;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TestRunService {

    private final PromptService promptService;
    private final EvaluationService evaluationService;
    private final TestRunLifecycleService lifecycleService;
    private final MetricsService metricsService;
    private final TestSuiteService testSuiteService;
    private final DatasetFingerprintService datasetFingerprintService;

    public TestRunResponse executeTest(TestRunRequest request) {
        PromptVersion promptVersion = promptService.getVersion(request.getPromptVersionId());
        List<EvaluationCaseRequest> persistedSuiteCases = resolvePersistedSuiteCases(request);
        String datasetFingerprint = fingerprint(request, persistedSuiteCases);
        TestRun run = lifecycleService.start(request, datasetFingerprint);

        try {
            List<TestResult> results = evaluate(request, promptVersion, persistedSuiteCases);
            String finalStatus = finalStatus(results);
            TestRun completedRun = lifecycleService.complete(run.getId(), results, finalStatus);
            return buildResponse(completedRun, results);
        } catch (RuntimeException executionFailure) {
            closeFailedRun(run.getId(), executionFailure);
            throw executionFailure;
        }
    }

    public TestRunResponse getTestRun(Long id) {
        TestRun run = lifecycleService.get(id);
        return buildResponse(run, lifecycleService.findResults(id));
    }

    public List<TestRunResponse> getTestRunsByVersion(Long versionId) {
        return lifecycleService.findByPromptVersionId(versionId).stream()
                .map(run -> buildResponse(run, lifecycleService.findResults(run.getId())))
                .toList();
    }

    private List<TestResult> evaluate(
            TestRunRequest request,
            PromptVersion promptVersion,
            List<EvaluationCaseRequest> persistedSuiteCases
    ) {
        if (persistedSuiteCases != null) {
            return evaluationService.evaluateCases(
                    promptVersion.getContent(), persistedSuiteCases,
                    request.getAiProvider(), request.getModelName());
        }
        if (request.getTestCases() != null && !request.getTestCases().isEmpty()) {
            return evaluationService.evaluateCases(
                    promptVersion.getContent(), request.getTestCases(),
                    request.getAiProvider(), request.getModelName());
        }
        return evaluationService.evaluate(
                promptVersion.getContent(), request.getTestInputs(),
                request.getAiProvider(), request.getModelName());
    }

    private String fingerprint(
            TestRunRequest request,
            List<EvaluationCaseRequest> persistedSuiteCases
    ) {
        if (persistedSuiteCases != null) {
            return datasetFingerprintService.fingerprintCases(persistedSuiteCases);
        }
        if (request.getTestCases() != null && !request.getTestCases().isEmpty()) {
            return datasetFingerprintService.fingerprintCases(request.getTestCases());
        }
        return datasetFingerprintService.fingerprintLegacyInputs(request.getTestInputs());
    }

    private List<EvaluationCaseRequest> resolvePersistedSuiteCases(TestRunRequest request) {
        if (request.getTestSuiteId() == null) {
            return null;
        }
        List<EvaluationCaseRequest> cases = testSuiteService.get(request.getTestSuiteId()).getCases();
        if (cases == null || cases.isEmpty()) {
            // 持久化测试集没有可执行用例时，不创建无意义的运行记录。
            throw new PromptExecutionException("EMPTY_TEST_SUITE", "测试集不包含可执行用例");
        }
        return cases;
    }

    private String finalStatus(List<TestResult> results) {
        long completedCases = results.stream()
                .filter(result -> "COMPLETED".equals(result.getStatus()))
                .count();
        if (completedCases == results.size()) {
            return "COMPLETED";
        }
        return completedCases == 0 ? "FAILED" : "PARTIAL";
    }

    private void closeFailedRun(Long runId, RuntimeException executionFailure) {
        try {
            lifecycleService.fail(runId);
        } catch (RuntimeException persistenceFailure) {
            // 保留原始执行异常作为主因，同时不吞掉失败状态落库异常。
            executionFailure.addSuppressed(persistenceFailure);
        }
    }

    private TestRunResponse buildResponse(TestRun run, List<TestResult> results) {
        TestRunResponse response = new TestRunResponse();
        response.setId(run.getId());
        response.setPromptVersionId(run.getPromptVersionId());
        response.setTestSuiteId(run.getTestSuiteId());
        response.setDatasetFingerprint(run.getDatasetFingerprint());
        response.setAiProvider(run.getAiProvider());
        response.setModelName(run.getModelName());
        response.setStartedAt(run.getStartedAt());
        response.setCompletedAt(run.getCompletedAt());
        response.setStatus(run.getStatus());
        response.setResults(results);
        response.setMetrics(metricsService.calculateMetrics(results));
        return response;
    }
}
