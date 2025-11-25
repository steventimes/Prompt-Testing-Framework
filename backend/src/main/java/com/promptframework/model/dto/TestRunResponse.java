package com.promptframework.model.dto;

import lombok.Data;
import com.promptframework.model.entity.TestResult;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TestRunResponse {

    private Long id;
    private Long promptVersionId;
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
        private Integer totalTokens;
        private Double totalCostUsd;
    }
}
