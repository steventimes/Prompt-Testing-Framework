package com.promptframework.model.entity;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import com.promptframework.model.dto.AssertionResult;
import com.promptframework.model.dto.McpToolCall;

@Data
public class TestResult {

    private Long id;
    private Long testRunId;
    private String caseName;
    private Map<String, String> inputVariables;
    private String aiResponse;
    private Integer responseTimeMs;
    private Integer tokenCount;
    private String status;
    private String errorCode;
    private String errorMessage;
    private BigDecimal costUsd;
    private Double qualityScore;
    private Boolean assertionPassed;
    private List<AssertionResult> assertionResults;
    private Double privacyRiskScore;
    private List<String> privacyFlags;
    private List<McpToolCall> mcpCalls;
    private LocalDateTime createdAt;
}
