package com.promptframework.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * 可复用测试用例：变量负责驱动模板，断言负责定义可自动判定的验收标准。
 */
public record EvaluationCaseRequest(
        @Size(max = 200) String name,
        // 变量值可以是空字符串，但不能为 null，避免模板渲染时出现歧义。
        @NotNull Map<String, @NotNull String> variables,
        // 断言项必须存在，并递归校验其规则字段。
        @Valid @Size(max = 20) List<@NotNull @Valid AssertionRule> assertions
) {
}
