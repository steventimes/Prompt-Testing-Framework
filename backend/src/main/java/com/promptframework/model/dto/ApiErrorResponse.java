package com.promptframework.model.dto;

import java.time.Instant;
import java.util.Map;

/**
 * 所有 HTTP 错误共用同一结构，前端只需处理一套失败协议。
 */
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        Map<String, String> fieldErrors
) {
    public ApiErrorResponse {
        fieldErrors = fieldErrors == null ? Map.of() : Map.copyOf(fieldErrors);
    }
}
