package com.promptframework.service;

import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestRunService {

    private final PromptService promptService;
    private final AIExecutionService aiExecutionService;
    private final TestRunMapper testRunMapper;
    private final TestResultMapper testResultMapper;
    private final MetricsService metricsService;

    /**
     * test run
     */
    @Transactional
    public TestRunResponse executeTest(TestRunRequest request) {
        log.info("Starting test run for prompt version: {}", request.getPromptVersionId());

        PromptVersion promptVersion = promptService.getVersion(request.getPromptVersionId());

        TestRun testRun = new TestRun();
        testRun.setPromptVersionId(request.getPromptVersionId());
        testRun.setAiProvider(request.getAiProvider());
        testRun.setModelName(request.getModelName());
        testRun.setStatus("RUNNING");
        testRunMapper.insert(testRun);

        List<TestResult> results = new ArrayList<>();
        request.getTestInputs().forEach(variables -> {
            try {
                TestResult result = executeSingleTest(
                        testRun.getId(),
                        promptVersion.getContent(),
                        variables,
                        request.getAiProvider(),
                        request.getModelName()
                );
                results.add(result);
            } catch (Exception e) {
                log.error("Failed to execute test with variables: {}", variables, e);
            }
        });

        testRunMapper.updateCompletion(testRun.getId(), "COMPLETED");
        testRun.setStatus("COMPLETED");
        testRun.setCompletedAt(LocalDateTime.now());

        TestRunResponse.MetricsSummary metrics = metricsService.calculateMetrics(results);

        TestRunResponse response = new TestRunResponse();
        response.setId(testRun.getId());
        response.setPromptVersionId(testRun.getPromptVersionId());
        response.setAiProvider(testRun.getAiProvider());
        response.setModelName(testRun.getModelName());
        response.setStartedAt(testRun.getStartedAt());
        response.setCompletedAt(testRun.getCompletedAt());
        response.setStatus(testRun.getStatus());
        response.setResults(results);
        response.setMetrics(metrics);

        log.info("Completed test run {} with {} results", testRun.getId(), results.size());
        return response;
    }

    /**
     * Execute a single test with one set of inputs
     */
    private TestResult executeSingleTest(Long testRunId, String promptContent,
            Map<String, String> variables,
            String aiProvider, String modelName) {

        // long startTime = System.currentTimeMillis();
        AIExecutionService.AIResponse aiResponse = aiExecutionService.execute(
                promptContent, variables, aiProvider, modelName
        );

        TestResult result = new TestResult();
        result.setTestRunId(testRunId);
        result.setInputVariables(variables);
        result.setAiResponse(aiResponse.getResponseText());
        result.setResponseTimeMs(aiResponse.getResponseTimeMs());
        result.setTokenCount(aiResponse.getTokenCount());
        result.setCostUsd(BigDecimal.valueOf(aiResponse.getCostUsd()));
        result.setQualityScore(calculateQualityScore(aiResponse));

        testResultMapper.insert(result);

        return result;
    }

    private Double calculateQualityScore(AIExecutionService.AIResponse response) {
        double score = 0.5;

        // Longer responses score higher
        int length = response.getResponseText().length();
        if (length > 100 && length < 500) {
            score += 0.2;
        }

        // Faster responses score higher
        if (response.getResponseTimeMs() < 1000) {
            score += 0.2;
        }

        // Lower cost scores higher
        if (response.getCostUsd() < 0.01) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    public TestRunResponse getTestRun(Long testRunId) {
        TestRun testRun = testRunMapper.findById(testRunId);
        if (testRun == null) {
            throw new RuntimeException("Test run not found: " + testRunId);
        }

        List<TestResult> results = testResultMapper.findByTestRunId(testRunId);
        TestRunResponse.MetricsSummary metrics = metricsService.calculateMetrics(results);

        TestRunResponse response = new TestRunResponse();
        response.setId(testRun.getId());
        response.setPromptVersionId(testRun.getPromptVersionId());
        response.setAiProvider(testRun.getAiProvider());
        response.setModelName(testRun.getModelName());
        response.setStartedAt(testRun.getStartedAt());
        response.setCompletedAt(testRun.getCompletedAt());
        response.setStatus(testRun.getStatus());
        response.setResults(results);
        response.setMetrics(metrics);

        return response;
    }

    /**
     * Get all test runs for a specific prompt version
     */
    public List<TestRunResponse> getTestRunsByVersion(Long versionId) {
        List<TestRun> testRuns = testRunMapper.findByPromptVersionId(versionId);

        return testRuns.stream()
                .map(testRun -> {
                    List<TestResult> results = testResultMapper.findByTestRunId(testRun.getId());
                    TestRunResponse.MetricsSummary metrics = metricsService.calculateMetrics(results);

                    TestRunResponse response = new TestRunResponse();
                    response.setId(testRun.getId());
                    response.setPromptVersionId(testRun.getPromptVersionId());
                    response.setAiProvider(testRun.getAiProvider());
                    response.setModelName(testRun.getModelName());
                    response.setStartedAt(testRun.getStartedAt());
                    response.setCompletedAt(testRun.getCompletedAt());
                    response.setStatus(testRun.getStatus());
                    response.setResults(results);
                    response.setMetrics(metrics);

                    return response;
                })
                .collect(Collectors.toList());
    }
}
