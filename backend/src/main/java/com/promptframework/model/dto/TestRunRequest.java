package com.promptframework.model.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@Data
public class TestRunRequest {

    @NotNull(message = "Prompt version ID is required")
    private Long promptVersionId;

    @NotBlank(message = "AI provider is required")
    private String aiProvider;

    @NotBlank(message = "Model name is required")
    private String modelName;

    @NotEmpty(message = "At least one test input is required")
    private List<Map<String, String>> testInputs;  // List of variable sets
}
