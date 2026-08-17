package com.promptframework.model.dto;

import com.promptframework.model.entity.TestResult;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TestRunResponse {

    private Long id;
    private Long promptVersionId;
    private Long testSuiteId;
    private String datasetFingerprint;
    private String aiProvider;
    private String modelName;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String status;
    private List<TestResult> results;
    private MetricsSummary metrics;

    @Data
    public static class MetricsSummary {

        private Double averageResponseTimeMs;
        private Double averageQualityScore;
        private Integer qualityScoredCases;
        private Double qualityCoverage;
        private Integer totalTokens;
        private Double totalCostUsd;
        private Integer completedCases;
        private Integer failedCases;
        private Double averagePrivacyRiskScore;
        private Integer totalPrivacyFindings;
        private Integer totalAssertions;
        private Integer passedAssertions;
        private Integer failedAssertions;
        private Double assertionPassRate;
    }
}
