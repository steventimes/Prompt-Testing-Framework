package com.promptframework.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class QuickTestRequest {

    @NotBlank(message = "Prompt content is required")
    private String promptContent;

    @NotBlank(message = "AI provider is required")
    private String aiProvider;

    @NotBlank(message = "Model name is required")
    private String modelName;

    @NotEmpty(message = "At least one test input is required")
    private List<Map<String, String>> testInputs;
}
