package com.promptframework.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class RegressionGateRequest {

    @NotNull
    @Positive
    private Long baselineRunId;

    @Valid
    private RegressionGateRules gates = new RegressionGateRules();
}
