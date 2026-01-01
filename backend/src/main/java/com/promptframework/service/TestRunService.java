package com.promptframework.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestRunService {

    private final PromptService promptService;
    private final AIExecutionService aiExecutionService;
    private final TestRunMapper testRunMapper;
    private final TestResultMapper testResultMapper;
    private final MetricsService metricsService;

    @Transactional
    public TestRunResponse executeTest(TestRunRequest request, String apiKey) {
        PromptVersion promptVersion = promptService.getVersion(request.getPromptVersionId());

        TestRun testRun = new TestRun();
        testRun.setPromptVersionId(request.getPromptVersionId());
        testRun.setAiProvider(request.getAiProvider());
        testRun.setModelName(request.getModelName());
        testRun.setStatus("RUNNING");
        testRunMapper.insert(testRun);

        List<TestResult> results = new ArrayList<>();

        for (Map<String, String> inputs : request.getTestInputs()) {
            AIExecutionService.AIResponse aiResponse = aiExecutionService.execute(
                    promptVersion.getContent(),
                    inputs,
                    request.getAiProvider(),
                    request.getModelName(),
                    apiKey
            );

            TestResult result = new TestResult();
            result.setTestRunId(testRun.getId());
            result.setAiResponse(aiResponse.getResponseText());
            result.setResponseTimeMs(aiResponse.getResponseTimeMs());
            result.setTokenCount(aiResponse.getTokenCount());
            result.setCostUsd(BigDecimal.valueOf(aiResponse.getCostUsd()));
            result.setQualityScore(aiResponse.getQualityScore());

            testResultMapper.insert(result);
            results.add(result);
        }

        testRunMapper.updateCompletion(testRun.getId(), "COMPLETED");

        return buildResponse(testRun, results);
    }

    public TestRunResponse getTestRun(Long id) {
        TestRun testRun = testRunMapper.findById(id);
        List<TestResult> results = testResultMapper.findByTestRunId(id);
        return buildResponse(testRun, results);
    }

    public List<TestRunResponse> getTestRunsByVersion(Long versionId) {
        List<TestRun> testRuns = testRunMapper.findByPromptVersionId(versionId);
        return testRuns.stream()
                .map(run -> getTestRun(run.getId()))
                .collect(Collectors.toList());
    }

    private TestRunResponse buildResponse(TestRun run, List<TestResult> results) {
        TestRunResponse response = new TestRunResponse();
        response.setId(run.getId());
        response.setPromptVersionId(run.getPromptVersionId());
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
