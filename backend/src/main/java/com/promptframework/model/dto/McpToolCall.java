package com.promptframework.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class McpToolCall {

    private String toolName;
    private Integer durationMs;
    private String status;
    private String dataAccess;
}
