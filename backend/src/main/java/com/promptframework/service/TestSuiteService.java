package com.promptframework.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.mapper.TestSuiteMapper;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.TestSuiteUpsertRequest;
import com.promptframework.model.entity.TestSuite;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TestSuiteService {

    private final TestSuiteMapper testSuiteMapper;
    private final Clock clock;

    @Transactional
    public TestSuite create(TestSuiteUpsertRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        TestSuite suite = new TestSuite();
        apply(suite, request);
        suite.setCreatedAt(now);
        suite.setUpdatedAt(now);
        testSuiteMapper.insert(suite);
        return suite;
    }

    public List<TestSuite> list() {
        return testSuiteMapper.selectList(Wrappers.<TestSuite>lambdaQuery()
                .orderByDesc(TestSuite::getUpdatedAt));
    }

    public TestSuite get(Long id) {
        TestSuite suite = testSuiteMapper.selectById(id);
        if (suite == null) {
            throw new ResourceNotFoundException("TestSuite", id);
        }
        return suite;
    }

    @Transactional
    public TestSuite update(Long id, TestSuiteUpsertRequest request) {
        TestSuite suite = get(id);
        apply(suite, request);
        suite.setUpdatedAt(LocalDateTime.now(clock));
        testSuiteMapper.updateById(suite);
        return suite;
    }

    @Transactional
    public void delete(Long id) {
        get(id);
        testSuiteMapper.deleteById(id);
    }

    private void apply(TestSuite suite, TestSuiteUpsertRequest request) {
        suite.setName(request.name().trim());
        suite.setDescription(request.description() == null ? null : request.description().trim());
        suite.setCases(request.cases().stream().map(this::immutableCase).toList());
    }

    private EvaluationCaseRequest immutableCase(EvaluationCaseRequest testCase) {
        return new EvaluationCaseRequest(
                testCase.name() == null ? null : testCase.name().trim(),
                Collections.unmodifiableMap(new LinkedHashMap<>(testCase.variables())),
                testCase.assertions() == null ? List.of() : List.copyOf(testCase.assertions())
        );
    }
}
