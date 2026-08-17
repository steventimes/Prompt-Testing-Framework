package com.promptframework.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class QuickTestResponse {

    private String id;
    private String status;
    private Instant executedAt;
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
        private Integer qualityScoredCases;
        private Double qualityCoverage;
        private Integer totalTokens;
        private Double totalCostUsd;
        private Double averagePrivacyRiskScore;
        private Integer totalPrivacyFindings;
        private Integer completedCases;
        private Integer failedCases;
        private Integer totalAssertions;
        private Integer passedAssertions;
        private Integer failedAssertions;
        private Double assertionPassRate;
    }
}
