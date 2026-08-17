package com.promptframework.service;

import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.model.dto.PromptAuditEvidence;
import com.promptframework.model.dto.PromptReadinessRow;
import com.promptframework.model.dto.PromptReleaseBlocker;
import com.promptframework.model.dto.PromptReleaseGovernance;
import com.promptframework.model.dto.PromptReadinessStatus;
import com.promptframework.model.dto.WorkspaceSummaryResponse;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkspaceDashboardService {

    private final PromptMapper promptMapper;
    private final PromptVersionMapper promptVersionMapper;
    private final Clock clock;

    public WorkspaceSummaryResponse getWorkspaceSummary() {
        // 统一从可注入时钟获取 UTC 时间，避免测试和发布规则随机器日期漂移。
        LocalDateTime now = LocalDateTime.now(clock).atOffset(ZoneOffset.UTC).toLocalDateTime();
        List<PromptReadinessRow> rows = promptMapper.findAll().stream()
                .map(prompt -> toReadinessRow(prompt, promptVersionMapper.findByPromptId(prompt.getId()), now))
                .sorted(Comparator.comparing(PromptReadinessRow::latestActivityAt).reversed())
                .toList();

        int totalPrompts = rows.size();
        int totalVersions = rows.stream().mapToInt(PromptReadinessRow::versionCount).sum();
        int readyCount = (int) rows.stream()
                .filter(row -> "ready".equals(row.readiness().level()))
                .count();
        int promptsWithChallengers = (int) rows.stream()
                .filter(row -> row.versionCount() >= 2)
                .count();

        return new WorkspaceSummaryResponse(
                totalPrompts,
                totalVersions,
                totalPrompts == 0 ? 0.0 : Math.round((totalVersions * 10.0) / totalPrompts) / 10.0,
                readyCount,
                totalPrompts - readyCount,
                totalPrompts == 0 ? 0 : Math.round((readyCount * 100.0f) / totalPrompts),
                totalPrompts == 0 ? 0 : Math.round((promptsWithChallengers * 100.0f) / totalPrompts),
                buildReleaseGovernance(rows),
                buildAuditEvidence(rows, now),
                rows
        );
    }

    PromptAuditEvidence buildAuditEvidence(List<PromptReadinessRow> rows, LocalDateTime generatedAt) {
        int evidenceItemCount = rows.stream()
                .mapToInt(row -> 4 + ("ready".equals(row.readiness().level()) ? 0 : 1))
                .sum();

        return new PromptAuditEvidence(
                "PromptOps.AuditEvidence.v1",
                "promptops-workspace-" + generatedAt.toLocalDate(),
                generatedAt.truncatedTo(ChronoUnit.SECONDS).toString() + "Z",
                "retain release evidence, blocker history, and verification commands for at least 180 days",
                rows.size(),
                evidenceItemCount,
                List.of(
                        "prompt identity and owner context",
                        "version count and latest activity timestamp",
                        "readiness classification and reason",
                        "release blocker code and message when applicable",
                        "verification command list for frontend and backend checks"
                ),
                List.of(
                        "Prompt owner",
                        "PromptOps reviewer",
                        "Release manager"
                ),
                List.of("workspace summary API JSON", "release governance JSON", "audit evidence JSON"),
                "Audit evidence proves structural reviewability of the prompt workspace; it does not replace model safety, legal, privacy, or production approval sign-off."
        );
    }

    PromptReleaseGovernance buildReleaseGovernance(List<PromptReadinessRow> rows) {
        List<PromptReleaseBlocker> blockers = rows.stream()
                .filter(row -> !"ready".equals(row.readiness().level()))
                .map(row -> new PromptReleaseBlocker(
                        row.id(),
                        row.name(),
                        releaseBlockerCode(row.readiness().level()),
                        row.readiness().reason()
                ))
                .toList();

        int publishableCount = rows.size() - blockers.size();
        return new PromptReleaseGovernance(
                "PromptOps.ReleaseGovernance.v1",
                blockers.isEmpty() ? "approved" : "blocked",
                publishableCount,
                blockers.size(),
                blockers,
                List.of(
                        "prompt has at least one tested version",
                        "prompt has owner context",
                        "prompt has at least one challenger version",
                        "prompt has activity within 14 days"
                ),
                List.of(
                        "cd frontend && npm run test:all",
                        "cd backend && mvn test -Dtest=WorkspaceDashboardServiceTest"
                ),
                "Release approval means the prompt is structurally ready for controlled rollout; it does not certify model safety, legal approval, or production traffic eligibility."
        );
    }

    private String releaseBlockerCode(String readinessLevel) {
        return switch (readinessLevel) {
            case "blocked" -> "PROMPT_BLOCKED";
            case "attention" -> "PROMPT_NEEDS_REVIEW";
            case "watch" -> "PROMPT_REVIEW_STALE";
            default -> "PROMPT_NOT_RELEASE_READY";
        };
    }

    PromptReadinessRow toReadinessRow(Prompt prompt, List<PromptVersion> versions, LocalDateTime now) {
        LocalDateTime createdAt = prompt.getCreatedAt() == null ? now : prompt.getCreatedAt();
        LocalDateTime latestActivityAt = versions.stream()
                .map(PromptVersion::getCreatedAt)
                .map(created -> created == null ? createdAt : created)
                .max(LocalDateTime::compareTo)
                .orElse(createdAt);

        return new PromptReadinessRow(
                prompt.getId(),
                prompt.getName(),
                prompt.getDescription() == null ? "" : prompt.getDescription(),
                prompt.getCreatedAt(),
                versions.size(),
                latestActivityAt,
                classifyPromptReadiness(prompt, versions, latestActivityAt, now)
        );
    }

    PromptReadinessStatus classifyPromptReadiness(
            Prompt prompt,
            List<PromptVersion> versions,
            LocalDateTime latestActivityAt,
            LocalDateTime now
    ) {
        if (versions.isEmpty()) {
            return new PromptReadinessStatus(
                    "blocked",
                    "Needs version",
                    "No prompt version is available for testing."
            );
        }

        if (prompt.getDescription() == null || prompt.getDescription().isBlank()) {
            return new PromptReadinessStatus(
                    "attention",
                    "Needs owner context",
                    "Description is missing, which weakens review and handoff quality."
            );
        }

        if (versions.size() < 2) {
            return new PromptReadinessStatus(
                    "attention",
                    "Needs challenger",
                    "Only one version exists, so there is no A/B comparison baseline."
            );
        }

        long ageDays = ChronoUnit.DAYS.between(latestActivityAt, now);
        if (ageDays > 14) {
            return new PromptReadinessStatus(
                    "watch",
                    "Review stale",
                    "No recent activity in more than 14 days."
            );
        }

        return new PromptReadinessStatus(
                "ready",
                "Experiment ready",
                "Prompt has documentation and at least one challenger version."
        );
    }
}
