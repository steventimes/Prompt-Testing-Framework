package com.promptframework.service;

import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 管理运行记录的短事务；任何模型或断言计算都必须发生在该边界之外。
 */
@Service
@RequiredArgsConstructor
public class TestRunLifecycleService {

    private final TestRunMapper testRunMapper;
    private final TestResultMapper testResultMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TestRun start(TestRunRequest request) {
        return start(request, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TestRun start(TestRunRequest request, String datasetFingerprint) {
        TestRun run = new TestRun();
        run.setPromptVersionId(request.getPromptVersionId());
        run.setTestSuiteId(request.getTestSuiteId());
        run.setDatasetFingerprint(datasetFingerprint);
        run.setAiProvider(request.getAiProvider());
        run.setModelName(request.getModelName());
        run.setStatus("RUNNING");
        testRunMapper.insert(run);
        return run;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TestRun complete(Long runId, List<TestResult> results, String status) {
        for (TestResult result : results) {
            result.setTestRunId(runId);
            testResultMapper.insert(result);
        }
        testRunMapper.updateCompletion(runId, status);
        return requireRun(runId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long runId) {
        testRunMapper.updateCompletion(runId, "FAILED");
    }

    @Transactional(readOnly = true)
    public TestRun get(Long id) {
        return requireRun(id);
    }

    @Transactional(readOnly = true)
    public List<TestRun> findByPromptVersionId(Long promptVersionId) {
        return testRunMapper.findByPromptVersionId(promptVersionId);
    }

    @Transactional(readOnly = true)
    public List<TestResult> findResults(Long runId) {
        return testResultMapper.findByTestRunId(runId);
    }

    private TestRun requireRun(Long id) {
        TestRun run = testRunMapper.findById(id);
        if (run == null) {
            throw new ResourceNotFoundException("TestRun", id);
        }
        return run;
    }
}
