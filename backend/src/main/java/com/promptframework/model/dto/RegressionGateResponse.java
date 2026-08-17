package com.promptframework.model.dto;

import java.util.List;

public record RegressionGateResponse(
        Long baselineRunId,
        Long candidateRunId,
        String verdict,
        boolean passed,
        List<String> reasons,
        List<RegressionGateMetric> metrics,
        List<RegressionGateFailure> newFailures) {
}
