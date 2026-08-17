package com.promptframework.model.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuickTestResult {

    private String caseName;
    private Map<String, String> inputVariables;
    private String status;
    private String errorCode;
    private String errorMessage;
    private String aiResponse;
    private Integer responseTimeMs;
    private Integer tokenCount;
    private Double costUsd;
    private Double qualityScore;
    private Boolean assertionPassed;
    private List<AssertionResult> assertionResults;
    private List<McpToolCall> mcpCalls;
    private PrivacySummary privacySummary;
}
