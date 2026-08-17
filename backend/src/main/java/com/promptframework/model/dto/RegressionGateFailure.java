package com.promptframework.model.dto;

public record RegressionGateFailure(
        int index,
        String caseName,
        String errorCode) {
}
