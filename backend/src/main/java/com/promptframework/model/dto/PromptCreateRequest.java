package com.promptframework.model.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Data
public class PromptCreateRequest {

    @NotBlank(message = "Prompt title is required")
    @Size(max = 255, message = "Title must be less than 255 characters")
    private String name;

    @Size(max = 1000, message = "Description must be less than 1000 characters")
    private String description;

    @NotBlank(message = "Initial prompt is required")
    private String initialContent;
}
