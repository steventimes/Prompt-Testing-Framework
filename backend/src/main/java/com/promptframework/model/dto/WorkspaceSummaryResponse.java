package com.promptframework.model.dto;

import java.util.List;

public record WorkspaceSummaryResponse(
        int totalPrompts,
        int totalVersions,
        double averageVersions,
        int readyCount,
        int attentionCount,
        int readinessScore,
        int challengerCoverage,
        PromptReleaseGovernance releaseGovernance,
        PromptAuditEvidence auditEvidence,
        List<PromptReadinessRow> rows
) {
}
