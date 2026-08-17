package com.promptframework.model.dto;

import java.util.List;

public record PromptTemplateAnalysis(
        List<String> variables,
        List<String> missingVariables,
        String renderedContent,
        boolean complete
) {
}
