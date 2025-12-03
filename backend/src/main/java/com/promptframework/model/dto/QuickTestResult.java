package com.promptframework.model.dto;

import lombok.Data;
import java.util.Map;

@Data
public class QuickTestResult {

    private Map<String, String> inputVariables;
    private String aiResponse;
    private Integer responseTimeMs;
    private Integer tokenCount;
    private Double costUsd;
    private Double qualityScore;
}
