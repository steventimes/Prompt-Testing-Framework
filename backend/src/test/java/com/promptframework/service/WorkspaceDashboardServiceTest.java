package com.promptframework.service;

import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.model.dto.PromptReadinessRow;
import com.promptframework.model.dto.WorkspaceSummaryResponse;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkspaceDashboardServiceTest {

    private final LocalDateTime now = LocalDateTime.of(2026, 7, 9, 12, 0);

    @Test
    void classifiesPromptReadinessStates() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null);

        assertThat(service.classifyPromptReadiness(prompt(1L, "No version", "owner", now), List.of(), now, now).level())
                .isEqualTo("blocked");

        assertThat(service.classifyPromptReadiness(
                prompt(2L, "Missing context", "", now),
                List.of(version(21L, 2L, 1, now.minusDays(1))),
                now.minusDays(1),
                now
        ).label()).isEqualTo("Needs owner context");

        assertThat(service.classifyPromptReadiness(
                prompt(3L, "No challenger", "owned", now),
                List.of(version(31L, 3L, 1, now.minusDays(1))),
                now.minusDays(1),
                now
        ).label()).isEqualTo("Needs challenger");

        assertThat(service.classifyPromptReadiness(
                prompt(4L, "Stale", "owned", now.minusDays(30)),
                List.of(
                        version(41L, 4L, 1, now.minusDays(30)),
                        version(42L, 4L, 2, now.minusDays(20))
                ),
                now.minusDays(20),
                now
        ).level()).isEqualTo("watch");

        assertThat(service.classifyPromptReadiness(
                prompt(5L, "Ready", "owned", now.minusDays(3)),
                List.of(
                        version(51L, 5L, 1, now.minusDays(3)),
                        version(52L, 5L, 2, now.minusDays(1))
                ),
                now.minusDays(1),
                now
        ).level()).isEqualTo("ready");
    }

    @Test
    void summarizesWorkspaceForDashboardAndGovernanceQueue() {
        Prompt ready = prompt(1L, "Ready", "owned", now.minusDays(3));
        Prompt needsContext = prompt(2L, "Needs context", "", now.minusDays(2));
        Prompt blocked = prompt(3L, "Blocked", "owned", now.minusDays(4));

        PromptMapper promptMapper = new InMemoryPromptMapper(List.of(ready, needsContext, blocked));
        PromptVersionMapper versionMapper = new InMemoryPromptVersionMapper(Map.of(
                1L, List.of(version(11L, 1L, 1, now.minusDays(3)), version(12L, 1L, 2, now.minusDays(1))),
                2L, List.of(version(21L, 2L, 1, now.minusDays(2))),
                3L, List.of()
        ));

        WorkspaceSummaryResponse summary = new WorkspaceDashboardService(promptMapper, versionMapper).getWorkspaceSummary();

        assertThat(summary.totalPrompts()).isEqualTo(3);
        assertThat(summary.totalVersions()).isEqualTo(3);
        assertThat(summary.averageVersions()).isEqualTo(1.0);
        assertThat(summary.readyCount()).isEqualTo(1);
        assertThat(summary.attentionCount()).isEqualTo(2);
        assertThat(summary.readinessScore()).isEqualTo(33);
        assertThat(summary.challengerCoverage()).isEqualTo(33);
        assertThat(summary.releaseGovernance().schema()).isEqualTo("PromptOps.ReleaseGovernance.v1");
        assertThat(summary.releaseGovernance().releaseDecision()).isEqualTo("blocked");
        assertThat(summary.releaseGovernance().publishableCount()).isEqualTo(1);
        assertThat(summary.releaseGovernance().blockedCount()).isEqualTo(2);
        assertThat(summary.releaseGovernance().blockers())
                .extracting(blocker -> blocker.code())
                .containsExactly("PROMPT_NEEDS_REVIEW", "PROMPT_BLOCKED");
        assertThat(summary.releaseGovernance().verificationCommands())
                .contains("cd frontend && npm run test:all");
        assertThat(summary.auditEvidence().schema()).isEqualTo("PromptOps.AuditEvidence.v1");
        assertThat(summary.auditEvidence().artifactId()).startsWith("promptops-workspace-");
        assertThat(summary.auditEvidence().governedPromptCount()).isEqualTo(3);
        assertThat(summary.auditEvidence().evidenceItems())
                .contains("prompt identity and owner context", "readiness classification and reason");
        assertThat(summary.auditEvidence().riskDisclosure()).contains("does not replace model safety");
        assertThat(summary.rows()).extracting(PromptReadinessRow::name)
                .containsExactly("Ready", "Needs context", "Blocked");
    }

    @Test
    void buildsAuditEvidenceForReleaseReviewExport() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null);
        PromptReadinessRow ready = service.toReadinessRow(
                prompt(7L, "Ready", "owned", now.minusDays(2)),
                List.of(
                        version(71L, 7L, 1, now.minusDays(2)),
                        version(72L, 7L, 2, now.minusDays(1))
                ),
                now
        );
        PromptReadinessRow blocked = service.toReadinessRow(
                prompt(8L, "Blocked", "owned", now.minusDays(1)),
                List.of(),
                now
        );

        var evidence = service.buildAuditEvidence(List.of(ready, blocked), now);

        assertThat(evidence.schema()).isEqualTo("PromptOps.AuditEvidence.v1");
        assertThat(evidence.generatedAt()).isEqualTo("2026-07-09T12:00Z");
        assertThat(evidence.governedPromptCount()).isEqualTo(2);
        assertThat(evidence.evidenceItemCount()).isEqualTo(9);
        assertThat(evidence.controlOwners()).contains("PromptOps reviewer", "Release manager");
        assertThat(evidence.exportFormats()).contains("workspace summary API JSON", "audit evidence JSON");
    }

    @Test
    void buildsApprovedReleaseGovernanceWhenAllPromptsAreReady() {
        WorkspaceDashboardService service = new WorkspaceDashboardService(null, null);
        PromptReadinessRow row = service.toReadinessRow(
                prompt(7L, "Ready", "owned", now.minusDays(2)),
                List.of(
                        version(71L, 7L, 1, now.minusDays(2)),
                        version(72L, 7L, 2, now.minusDays(1))
                ),
                now
        );

        var governance = service.buildReleaseGovernance(List.of(row));

        assertThat(governance.releaseDecision()).isEqualTo("approved");
        assertThat(governance.publishableCount()).isEqualTo(1);
        assertThat(governance.blockedCount()).isZero();
        assertThat(governance.blockers()).isEmpty();
        assertThat(governance.riskDisclosure()).contains("controlled rollout");
    }

    private static Prompt prompt(Long id, String name, String description, LocalDateTime createdAt) {
        Prompt prompt = new Prompt();
        prompt.setId(id);
        prompt.setName(name);
        prompt.setDescription(description);
        prompt.setCreatedAt(createdAt);
        prompt.setUpdatedAt(createdAt);
        return prompt;
    }

    private static PromptVersion version(Long id, Long promptId, int versionNumber, LocalDateTime createdAt) {
        PromptVersion version = new PromptVersion();
        version.setId(id);
        version.setPromptId(promptId);
        version.setVersionNumber(versionNumber);
        version.setContent("version " + versionNumber);
        version.setCreatedAt(createdAt);
        return version;
    }

    private record InMemoryPromptMapper(List<Prompt> prompts) implements PromptMapper {
        @Override
        public void insert(Prompt prompt) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Prompt findById(Long id) {
            return prompts.stream().filter(prompt -> prompt.getId().equals(id)).findFirst().orElse(null);
        }

        @Override
        public List<Prompt> findAll() {
            return new ArrayList<>(prompts);
        }

        @Override
        public void update(Prompt prompt) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteById(Long id) {
            throw new UnsupportedOperationException();
        }
    }

    private record InMemoryPromptVersionMapper(Map<Long, List<PromptVersion>> versions) implements PromptVersionMapper {
        @Override
        public void insert(PromptVersion promptVersion) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PromptVersion findById(Long id) {
            return versions.values().stream()
                    .flatMap(List::stream)
                    .filter(version -> version.getId().equals(id))
                    .findFirst()
                    .orElse(null);
        }

        @Override
        public List<PromptVersion> findByPromptId(Long promptId) {
            return versions.getOrDefault(promptId, List.of());
        }

        @Override
        public PromptVersion findLatestByPromptId(Long promptId) {
            return findByPromptId(promptId).stream()
                    .max((left, right) -> left.getVersionNumber().compareTo(right.getVersionNumber()))
                    .orElse(null);
        }

        @Override
        public Integer getNextVersionNumber(Long promptId) {
            return findByPromptId(promptId).size() + 1;
        }
    }
}
