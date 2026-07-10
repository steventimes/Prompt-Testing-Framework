package com.promptframework.model.dto;

public record PromptReleaseBlocker(
        Long promptId,
        String promptName,
        String code,
        String message
) {
}
