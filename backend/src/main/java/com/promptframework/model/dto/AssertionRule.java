package com.promptframework.model.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 声明式断言：文本规则使用 value，数值门槛使用 threshold。
 */
public record AssertionRule(
        @NotNull AssertionType type,
        @Size(max = 2000) String value,
        @PositiveOrZero Double threshold
) {
}
