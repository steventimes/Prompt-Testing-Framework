package com.promptframework.model.dto;

import java.time.LocalDateTime;

public record PromptReadinessRow(
        Long id,
        String name,
        String description,
        LocalDateTime createdAt,
        int versionCount,
        LocalDateTime latestActivityAt,
        PromptReadinessStatus readiness
) {
}
