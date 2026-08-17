package com.promptframework.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PromptVersionCreateRequest {

    @NotBlank(message = "Version content is required")
    @Size(max = 100000, message = "Version content is too large")
    private String content;
}
