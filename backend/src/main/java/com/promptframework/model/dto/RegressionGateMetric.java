package com.promptframework.model.dto;

public record RegressionGateMetric(
        String name,
        Double baseline,
        Double candidate,
        Double delta,
        Double deltaPercent,
        Double limit,
        boolean available,
        boolean passed) {
}
