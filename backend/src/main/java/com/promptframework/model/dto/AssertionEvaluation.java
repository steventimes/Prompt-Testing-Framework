package com.promptframework.model.dto;

import java.util.List;

/**
 * 一条测试用例的断言汇总。
 */
public record AssertionEvaluation(boolean passed, List<AssertionResult> results) {
}
