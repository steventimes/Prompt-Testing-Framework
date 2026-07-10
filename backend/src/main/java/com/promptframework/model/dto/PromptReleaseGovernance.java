package com.promptframework.model.dto;

import java.util.List;

public record PromptReleaseGovernance(
        String schema,
        String releaseDecision,
        int publishableCount,
        int blockedCount,
        List<PromptReleaseBlocker> blockers,
        List<String> requiredChecks,
        List<String> verificationCommands,
        String riskDisclosure
) {
}
