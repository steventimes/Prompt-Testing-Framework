package com.promptframework.model.entity;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class TestResult {

    private Long id;
    private Long testRunId;
    private Map<String, String> inputVariables;
    private String aiResponse;
    private Integer responseTimeMs;
    private Integer tokenCount;
    private BigDecimal costUsd;
    private Double qualityScore;
    private LocalDateTime createdAt;
}
