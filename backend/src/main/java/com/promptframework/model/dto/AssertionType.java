package com.promptframework.model.dto;

/**
 * 内置断言类型。先覆盖确定性、可复现的本地规则，避免把回归门禁绑定到额外模型调用。
 */
public enum AssertionType {
    CONTAINS,
    NOT_CONTAINS,
    REGEX,
    JSON_VALID,
    MAX_LATENCY_MS,
    MAX_COST_USD,
    MIN_QUALITY_SCORE
}
