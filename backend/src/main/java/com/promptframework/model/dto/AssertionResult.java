package com.promptframework.model.dto;

/**
 * 单条断言的可审计证据，actual/expected 保持字符串形态以便 API 与 JSONB 稳定回放。
 */
public record AssertionResult(
        AssertionType type,
        boolean passed,
        String expected,
        String actual,
        String message
) {
}
