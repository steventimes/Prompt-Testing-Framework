package com.promptframework.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.promptframework.model.dto.AssertionEvaluation;
import com.promptframework.model.dto.AssertionResult;
import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.AssertionType;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
public class AssertionEvaluationService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public AssertionEvaluation evaluate(
            String output,
            Integer latencyMs,
            BigDecimal costUsd,
            Double qualityScore,
            List<AssertionRule> rules
    ) {
        List<AssertionRule> safeRules = rules == null ? List.of() : rules;
        List<AssertionResult> results = new ArrayList<>(safeRules.size());
        for (AssertionRule rule : safeRules) {
            results.add(evaluateRule(rule, output, latencyMs, costUsd, qualityScore));
        }
        return new AssertionEvaluation(
                results.stream().allMatch(AssertionResult::passed),
                List.copyOf(results)
        );
    }

    private AssertionResult evaluateRule(
            AssertionRule rule,
            String output,
            Integer latencyMs,
            BigDecimal costUsd,
            Double qualityScore
    ) {
        if (rule == null || rule.type() == null) {
            return result(null, false, "有效断言类型", null, "断言类型不能为空");
        }

        String safeOutput = output == null ? "" : output;
        return switch (rule.type()) {
            case CONTAINS -> evaluateContains(rule, safeOutput, false);
            case NOT_CONTAINS -> evaluateContains(rule, safeOutput, true);
            case REGEX -> evaluateRegex(rule, safeOutput);
            case JSON_VALID -> evaluateJson(safeOutput);
            case MAX_LATENCY_MS -> evaluateMaximum(rule, latencyMs, "ms");
            case MAX_COST_USD -> evaluateMaximum(rule,
                    costUsd == null ? null : costUsd.doubleValue(), "USD");
            case MIN_QUALITY_SCORE -> evaluateMinimum(rule, qualityScore);
        };
    }

    private AssertionResult evaluateContains(AssertionRule rule, String output, boolean negate) {
        if (rule.value() == null || rule.value().isBlank()) {
            return result(rule.type(), false, "非空文本", output, "文本断言缺少 value");
        }
        boolean contains = output.contains(rule.value());
        boolean passed = negate ? !contains : contains;
        String message = passed
                ? (negate ? "输出未包含禁用文本" : "输出包含期望文本")
                : (negate ? "输出包含了禁用文本" : "输出缺少期望文本");
        return result(rule.type(), passed, rule.value(), output, message);
    }

    private AssertionResult evaluateRegex(AssertionRule rule, String output) {
        if (rule.value() == null || rule.value().isBlank()) {
            return result(rule.type(), false, "非空正则", output, "正则断言缺少 value");
        }
        try {
            boolean passed = Pattern.compile(rule.value()).matcher(output).find();
            return result(rule.type(), passed, rule.value(), output,
                    passed ? "输出匹配正则" : "输出未匹配正则");
        } catch (PatternSyntaxException exception) {
            return result(rule.type(), false, rule.value(), output, "正则表达式无效");
        }
    }

    private AssertionResult evaluateJson(String output) {
        try {
            objectMapper.readTree(output);
            return result(AssertionType.JSON_VALID, true, "有效 JSON", output, "输出是有效 JSON");
        } catch (Exception exception) {
            return result(AssertionType.JSON_VALID, false, "有效 JSON", output, "输出不是有效 JSON");
        }
    }

    private AssertionResult evaluateMaximum(AssertionRule rule, Number actual, String unit) {
        if (rule.threshold() == null) {
            return result(rule.type(), false, "非负阈值", valueOf(actual), "数值断言缺少 threshold");
        }
        boolean passed = actual != null && actual.doubleValue() <= rule.threshold();
        return result(rule.type(), passed, "≤ " + rule.threshold() + " " + unit,
                valueOf(actual), passed ? "未超过上限" : "超过允许上限");
    }

    private AssertionResult evaluateMinimum(AssertionRule rule, Number actual) {
        if (rule.threshold() == null) {
            return result(rule.type(), false, "非负阈值", valueOf(actual), "数值断言缺少 threshold");
        }
        if (actual == null) {
            return result(rule.type(), false, "≥ " + rule.threshold(), null, "质量分不可用");
        }
        boolean passed = actual.doubleValue() >= rule.threshold();
        return result(rule.type(), passed, "≥ " + rule.threshold(), valueOf(actual),
                passed ? "达到质量下限" : "低于质量下限");
    }

    private AssertionResult result(
            AssertionType type,
            boolean passed,
            String expected,
            String actual,
            String message
    ) {
        // 输出可能包含敏感原文；断言证据仅保留最多 500 个字符。
        String boundedActual = actual == null || actual.length() <= 500 ? actual : actual.substring(0, 500);
        return new AssertionResult(type, passed, expected, boundedActual, message);
    }

    private String valueOf(Number value) {
        return value == null ? null : value.toString();
    }
}
