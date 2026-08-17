package com.promptframework.service;

import com.promptframework.exception.PromptExecutionException;
import com.promptframework.model.dto.AssertionEvaluation;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.entity.TestResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@Slf4j
public class EvaluationService {

    private final AIExecutionService aiExecutionService;
    private final AssertionEvaluationService assertionEvaluationService;

    @Autowired
    public EvaluationService(AIExecutionService aiExecutionService,
            AssertionEvaluationService assertionEvaluationService) {
        this.aiExecutionService = aiExecutionService;
        this.assertionEvaluationService = assertionEvaluationService;
    }

    // 保留简单输入调用形式，旧客户端无需立刻迁移到高级用例结构。
    public EvaluationService(AIExecutionService aiExecutionService) {
        this(aiExecutionService, new AssertionEvaluationService());
    }

    /**
     * 兼容旧版 Map 输入，并统一转换成高级测试用例。
     */
    public List<TestResult> evaluate(
            String promptContent,
            List<Map<String, String>> testInputs,
            String aiProvider,
            String modelName
    ) {
        List<EvaluationCaseRequest> cases = testInputs == null ? List.of() : testInputs.stream()
                // 保留 null，让统一用例校验产生可追溯的 INVALID_TEST_CASE 证据。
                .map(inputs -> new EvaluationCaseRequest(null, inputs, List.of()))
                .toList();
        return evaluateCases(promptContent, cases, aiProvider, modelName);
    }

    /**
     * 逐条执行测试集并保留完整证据；单条失败不会阻断同批次中的其他用例。
     */
    public List<TestResult> evaluateCases(
            String promptContent,
            List<EvaluationCaseRequest> cases,
            String aiProvider,
            String modelName
    ) {
        if (cases == null || cases.isEmpty()) {
            return List.of();
        }

        List<TestResult> results = new ArrayList<>(cases.size());
        for (EvaluationCaseRequest testCase : cases) {
            TestResult result = new TestResult();
            result.setInputVariables(Map.of());
            result.setAssertionResults(List.of());

            try {
                if (testCase == null) {
                    throw new PromptExecutionException("INVALID_TEST_CASE", "测试用例无效");
                }

                Map<String, String> inputs = testCase.variables();
                result.setCaseName(testCase.name());
                if (inputs == null) {
                    throw new PromptExecutionException("INVALID_TEST_CASE", "测试用例变量不能为空");
                }
                result.setInputVariables(immutableInputSnapshot(inputs));
                if (inputs.values().stream().anyMatch(Objects::isNull)) {
                    throw new PromptExecutionException("INVALID_TEST_CASE", "测试用例变量包含空值");
                }

                AIExecutionService.AIResponse aiResponse = aiExecutionService.execute(
                        promptContent,
                        result.getInputVariables(),
                        aiProvider,
                        modelName
                );
                result.setStatus("COMPLETED");
                result.setAiResponse(aiResponse.getResponseText());
                result.setResponseTimeMs(aiResponse.getResponseTimeMs());
                result.setTokenCount(aiResponse.getTokenCount());
                // 真实调用尚无可信价格表时 costUsd 为 null；必须安全持久化为未知。
                result.setCostUsd(aiResponse.getCostUsd() == null ? null : BigDecimal.valueOf(aiResponse.getCostUsd()));
                result.setQualityScore(aiResponse.getQualityScore());
                result.setMcpCalls(aiResponse.getMcpCalls());
                if (aiResponse.getPrivacySummary() != null) {
                    result.setPrivacyRiskScore(aiResponse.getPrivacySummary().getRiskScore());
                    result.setPrivacyFlags(aiResponse.getPrivacySummary().getFlags());
                }

                AssertionEvaluation assertionEvaluation = assertionEvaluationService.evaluate(
                        result.getAiResponse(),
                        result.getResponseTimeMs(),
                        result.getCostUsd(),
                        result.getQualityScore(),
                        testCase.assertions()
                );
                result.setAssertionPassed(assertionEvaluation.passed());
                result.setAssertionResults(assertionEvaluation.results());
                if (!assertionEvaluation.passed()) {
                    result.setStatus("FAILED");
                    result.setErrorCode("ASSERTION_FAILED");
                    result.setErrorMessage("输出未通过全部声明式断言");
                }
            } catch (PromptExecutionException exception) {
                result.setStatus("FAILED");
                result.setErrorCode(exception.getCode());
                result.setErrorMessage(exception.getMessage());
                log.warn("Evaluation case failed: {}", exception.getCode());
            } catch (RuntimeException exception) {
                // 不向 API 泄露内部异常细节，但日志保留完整堆栈以便排障。
                result.setStatus("FAILED");
                result.setErrorCode("EXECUTION_INTERNAL_ERROR");
                result.setErrorMessage("执行用例时发生内部错误");
                log.error("Unexpected evaluation case failure", exception);
            }
            results.add(result);
        }
        return List.copyOf(results);
    }

    // 失败用例也保留输入证据；LinkedHashMap 支持空值且快照对外不可变。
    private Map<String, String> immutableInputSnapshot(Map<String, String> inputs) {
        return inputs == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(inputs));
    }
}
