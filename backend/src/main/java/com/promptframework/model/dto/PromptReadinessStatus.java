package com.promptframework.model.dto;

public record PromptReadinessStatus(
        String level,
        String label,
        String reason
) {
}
