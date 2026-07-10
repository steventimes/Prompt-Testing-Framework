package com.promptframework.model.dto;

import java.util.List;

public record PromptAuditEvidence(
        String schema,
        String artifactId,
        String generatedAt,
        String retentionPolicy,
        int governedPromptCount,
        int evidenceItemCount,
        List<String> evidenceItems,
        List<String> controlOwners,
        List<String> exportFormats,
        String riskDisclosure
) {
}
