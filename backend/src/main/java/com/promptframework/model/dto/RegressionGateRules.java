package com.promptframework.model.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegressionGateRules {

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private Double minCasePassRate = 1.0;

    @NotNull
    @DecimalMin("0.0")
    private Double maxQualityScoreDrop = 0.03;

    @NotNull
    @DecimalMin("0.0")
    private Double maxCostIncreasePercent = 20.0;

    @NotNull
    @DecimalMin("0.0")
    private Double maxLatencyIncreasePercent = 25.0;
}
