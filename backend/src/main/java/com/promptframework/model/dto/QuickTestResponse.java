package com.promptframework.model.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import java.util.List;

@Data
public class QuickTestResponse {

    private String promptContent;
    private String aiProvider;
    private String modelName;
    private List<QuickTestResult> results;
    private MetricsSummary metrics;

    @Data
    @AllArgsConstructor
    public static class MetricsSummary {

        private Double averageResponseTimeMs;
        private Double averageQualityScore;
        private Integer totalTokens;
        private Double totalCostUsd;
    }
}
