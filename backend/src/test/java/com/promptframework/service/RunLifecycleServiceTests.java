package com.promptframework.service;

import com.promptframework.exception.PromptExecutionException;
import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.mapper.TestResultMapper;
import com.promptframework.mapper.TestRunMapper;
import com.promptframework.mapper.TestSuiteMapper;
import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.AssertionType;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.PromptCreateRequest;
import com.promptframework.model.dto.PromptUpdateRequest;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestSuiteUpsertRequest;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestRun;
import com.promptframework.model.entity.TestSuite;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PromptServiceTest {

    @Test
    void createsNormalizedPromptAndReturnsInitialVersion() {
        InMemoryPromptMapper prompts = new InMemoryPromptMapper();
        InMemoryVersionMapper versions = new InMemoryVersionMapper();
        PromptService service = new PromptService(prompts, versions);
        PromptCreateRequest request = new PromptCreateRequest();
        request.setName("  Checkout assistant  ");
        request.setDescription("  Owned by Growth Ops  ");
        request.setInitialContent("  Answer {{question}}  ");

        var response = service.createPrompt(request);

        assertThat(response.getName()).isEqualTo("Checkout assistant");
        assertThat(response.getDescription()).isEqualTo("Owned by Growth Ops");
        assertThat(response.getVersions()).singleElement()
                .satisfies(version -> {
                    assertThat(version.getVersionNumber()).isEqualTo(1);
                    assertThat(version.getContent()).isEqualTo("Answer {{question}}");
                });
    }

    @Test
    void updatesMetadataAndListsCompletePromptResponses() {
        InMemoryPromptMapper prompts = new InMemoryPromptMapper();
        InMemoryVersionMapper versions = new InMemoryVersionMapper();
        PromptService service = new PromptService(prompts, versions);
        Long id = seedPrompt(service, "Before");
        PromptUpdateRequest request = new PromptUpdateRequest();
        request.setName("  After  ");
        request.setDescription("  Production owner: Support  ");

        var updated = service.updatePrompt(id, request);

        assertThat(updated.getName()).isEqualTo("After");
        assertThat(updated.getDescription()).isEqualTo("Production owner: Support");
        assertThat(service.getAllPrompts()).singleElement()
                .satisfies(item -> assertThat(item.getVersions()).hasSize(1));
    }

    @Test
    void locksPromptBeforeAllocatingNextVersionAndRejectsMissingPrompt() {
        InMemoryPromptMapper prompts = new InMemoryPromptMapper();
        InMemoryVersionMapper versions = new InMemoryVersionMapper();
        PromptService service = new PromptService(prompts, versions);
        Long id = seedPrompt(service, "Versioned");

        PromptVersion version = service.createNewVersion(id, "  challenger  ");

        assertThat(prompts.lockedIds).containsExactly(id);
        assertThat(version.getVersionNumber()).isEqualTo(2);
        assertThat(version.getContent()).isEqualTo("challenger");
        assertThatThrownBy(() -> service.createNewVersion(999L, "missing"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Prompt");
    }

    @Test
    void deletesExistingPromptAndRejectsRepeatedDelete() {
        InMemoryPromptMapper prompts = new InMemoryPromptMapper();
        InMemoryVersionMapper versions = new InMemoryVersionMapper();
        PromptService service = new PromptService(prompts, versions);
        Long id = seedPrompt(service, "Disposable");

        service.deletePrompt(id);

        assertThat(service.getAllPrompts()).isEmpty();
        assertThatThrownBy(() -> service.deletePrompt(id)).isInstanceOf(ResourceNotFoundException.class);
    }

    private static Long seedPrompt(PromptService service, String name) {
        PromptCreateRequest request = new PromptCreateRequest();
        request.setName(name);
        request.setDescription("owner");
        request.setInitialContent("content");
        return service.createPrompt(request).getId();
    }

    private static final class InMemoryPromptMapper implements PromptMapper {

        private final Map<Long, Prompt> prompts = new LinkedHashMap<>();
        private final List<Long> lockedIds = new ArrayList<>();

        @Override
        public void insert(Prompt prompt) {
            prompt.setId((long) prompts.size() + 1);
            prompt.setCreatedAt(LocalDateTime.of(2026, 8, 10, 9, 0));
            prompt.setUpdatedAt(prompt.getCreatedAt());
            prompts.put(prompt.getId(), prompt);
        }

        @Override
        public Prompt findById(Long id) {
            return prompts.get(id);
        }

        @Override
        public Prompt findByIdForUpdate(Long id) {
            lockedIds.add(id);
            return prompts.get(id);
        }

        @Override
        public List<Prompt> findAll() {
            return new ArrayList<>(prompts.values());
        }

        @Override
        public void update(Prompt prompt) {
            prompt.setUpdatedAt(LocalDateTime.of(2026, 8, 10, 9, 30));
            prompts.put(prompt.getId(), prompt);
        }

        @Override
        public void deleteById(Long id) {
            prompts.remove(id);
        }
    }

    private static final class InMemoryVersionMapper implements PromptVersionMapper {

        private final List<PromptVersion> versions = new ArrayList<>();

        @Override
        public void insert(PromptVersion promptVersion) {
            promptVersion.setId((long) versions.size() + 10);
            promptVersion.setCreatedAt(LocalDateTime.of(2026, 8, 10, 9, versions.size()));
            versions.add(promptVersion);
        }

        @Override
        public PromptVersion findById(Long id) {
            return versions.stream().filter(version -> version.getId().equals(id)).findFirst().orElse(null);
        }

        @Override
        public List<PromptVersion> findByPromptId(Long promptId) {
            return versions.stream().filter(version -> version.getPromptId().equals(promptId)).toList();
        }

        @Override
        public PromptVersion findLatestByPromptId(Long promptId) {
            return findByPromptId(promptId).stream().reduce((left, right) -> right).orElse(null);
        }

        @Override
        public Integer getNextVersionNumber(Long promptId) {
            return findByPromptId(promptId).size() + 1;
        }
    }
}

class TestSuiteServiceTest {

    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-08-10T09:00:00Z"), ZoneOffset.UTC);

    @Test
    void createsReusableSuiteWithStableCaseAndAssertionOrder() {
        TestSuiteMapper mapper = mock(TestSuiteMapper.class);
        doAnswer(invocation -> {
            TestSuite suite = invocation.getArgument(0);
            suite.setId(7L);
            return 1;
        }).when(mapper).insert(any(TestSuite.class));
        TestSuiteService service = new TestSuiteService(mapper, CLOCK);

        TestSuite created = service.create(request("发布回归集"));

        assertThat(created.getId()).isEqualTo(7L);
        assertThat(created.getName()).isEqualTo("发布回归集");
        assertThat(created.getCases()).singleElement().satisfies(testCase -> {
            assertThat(testCase.name()).isEqualTo("基础发布");
            assertThat(testCase.variables()).containsEntry("topic", "发布");
            assertThat(testCase.assertions()).extracting(AssertionRule::type)
                    .containsExactly(AssertionType.CONTAINS, AssertionType.MAX_LATENCY_MS);
        });
        assertThat(created.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 8, 10, 9, 0));
        assertThat(created.getUpdatedAt()).isEqualTo(created.getCreatedAt());
    }

    @Test
    void rejectsUpdateWhenSuiteDoesNotExist() {
        TestSuiteMapper mapper = mock(TestSuiteMapper.class);
        when(mapper.selectById(404L)).thenReturn(null);
        TestSuiteService service = new TestSuiteService(mapper, CLOCK);

        assertThatThrownBy(() -> service.update(404L, request("不存在")))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("TestSuite not found: 404");
    }

    private static TestSuiteUpsertRequest request(String name) {
        return new TestSuiteUpsertRequest(
                name,
                "用于版本发布前的确定性回归",
                List.of(new EvaluationCaseRequest(
                        "基础发布",
                        Map.of("topic", "发布"),
                        List.of(
                                new AssertionRule(AssertionType.CONTAINS, "发布", null),
                                new AssertionRule(AssertionType.MAX_LATENCY_MS, null, 800.0)
                        )
                ))
        );
    }
}

class TestRunServiceTest {

    @Test
    void preservesInputsAndMarksMixedCaseExecutionAsPartial() {
        Fixture fixture = new Fixture("主题 {{topic}}，语气 {{tone}}");

        var response = fixture.service.executeTest(request(List.of(
                Map.of("topic", "退款", "tone", "专业"),
                Map.of("topic", "账单")
        )));

        assertThat(response.getStatus()).isEqualTo("PARTIAL");
        assertThat(response.getDatasetFingerprint())
                .isEqualTo("acb63b2ee43fcf71272674ab98b81975f37ae6bd6c7f4ddf46a4b4920fcd480c");
        assertThat(response.getResults()).hasSize(2);
        assertThat(response.getResults().get(0).getInputVariables())
                .isEqualTo(Map.of("topic", "退款", "tone", "专业"));
        assertThat(response.getResults().get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(response.getResults().get(1).getStatus()).isEqualTo("FAILED");
        assertThat(response.getResults().get(1).getErrorCode()).isEqualTo("PROMPT_VARIABLES_MISSING");
        assertThat(fixture.results.findByTestRunId(1L)).hasSize(2);
        assertThat(response.getMetrics().getCompletedCases()).isEqualTo(1);
        assertThat(response.getMetrics().getFailedCases()).isEqualTo(1);
    }

    @Test
    void marksRunFailedWhenEveryCaseFailsWithoutDroppingFailureEvidence() {
        Fixture fixture = new Fixture("回答 {{question}}");

        var response = fixture.service.executeTest(request(List.of(Map.of(), Map.of())));

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getResults()).allSatisfy(result -> {
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorMessage()).contains("缺少 Prompt 变量");
        });
        assertThat(response.getMetrics().getCompletedCases()).isZero();
        assertThat(response.getMetrics().getFailedCases()).isEqualTo(2);
    }

    @Test
    void completesRunAndAggregatesOnlySuccessfulCases() {
        Fixture fixture = new Fixture("固定内容");

        var response = fixture.service.executeTest(request(List.of(Map.of(), Map.of())));

        assertThat(response.getStatus()).isEqualTo("COMPLETED");
        assertThat(response.getMetrics().getCompletedCases()).isEqualTo(2);
        assertThat(response.getMetrics().getFailedCases()).isZero();
        assertThat(response.getMetrics().getTotalTokens()).isPositive();
    }

    @Test
    void reportsMissingRunsThroughTheSharedNotFoundContract() {
        Fixture fixture = new Fixture("固定内容");

        assertThatThrownBy(() -> fixture.service.getTestRun(404L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("TestRun not found: 404");
    }

    private static TestRunRequest request(List<Map<String, String>> inputs) {
        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(10L);
        request.setAiProvider("openai");
        request.setModelName("demo-model");
        request.setTestInputs(inputs);
        return request;
    }

    private static final class Fixture {

        private final InMemoryTestRunMapper runs = new InMemoryTestRunMapper();
        private final InMemoryTestResultMapper results = new InMemoryTestResultMapper();
        private final TestRunService service;

        private Fixture(String content) {
            PromptVersion version = new PromptVersion();
            version.setId(10L);
            version.setPromptId(1L);
            version.setVersionNumber(1);
            version.setContent(content);

            PromptVersionMapper versions = new SingleVersionMapper(version);
            PromptService promptService = new PromptService(null, versions);
            AIExecutionService executionService = new AIExecutionService(
                    true,
                    TestChatModelResolver.unused(),
                    new PromptTemplateService()
            );
            service = new TestRunService(
                    promptService,
                    new EvaluationService(executionService),
                    new TestRunLifecycleService(runs, results),
                    new MetricsService(),
                    null,
                    new DatasetFingerprintService()
            );
        }
    }

    private static final class InMemoryTestRunMapper implements TestRunMapper {

        private TestRun run;

        @Override
        public void insert(TestRun testRun) {
            testRun.setId(1L);
            testRun.setStartedAt(LocalDateTime.of(2026, 8, 10, 8, 0));
            run = testRun;
        }

        @Override
        public TestRun findById(Long id) {
            return run;
        }

        @Override
        public List<TestRun> findByPromptVersionId(Long promptVersionId) {
            return run == null ? List.of() : List.of(run);
        }

        @Override
        public void updateCompletion(Long id, String status) {
            run.setStatus(status);
            run.setCompletedAt(LocalDateTime.of(2026, 8, 10, 8, 1));
        }
    }

    private static final class InMemoryTestResultMapper implements TestResultMapper {

        private final List<TestResult> results = new ArrayList<>();

        @Override
        public void insert(TestResult testResult) {
            testResult.setId((long) results.size() + 1);
            results.add(testResult);
        }

        @Override
        public TestResult findById(Long id) {
            return results.stream().filter(result -> result.getId().equals(id)).findFirst().orElse(null);
        }

        @Override
        public List<TestResult> findByTestRunId(Long testRunId) {
            return results.stream().filter(result -> result.getTestRunId().equals(testRunId)).toList();
        }
    }

    private record SingleVersionMapper(PromptVersion version) implements PromptVersionMapper {

        @Override
        public void insert(PromptVersion promptVersion) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PromptVersion findById(Long id) {
            return version.getId().equals(id) ? version : null;
        }

        @Override
        public List<PromptVersion> findByPromptId(Long promptId) {
            return version.getPromptId().equals(promptId) ? List.of(version) : List.of();
        }

        @Override
        public PromptVersion findLatestByPromptId(Long promptId) {
            return version.getPromptId().equals(promptId) ? version : null;
        }

        @Override
        public Integer getNextVersionNumber(Long promptId) {
            return 2;
        }
    }
}

class TestRunLifecycleOrchestrationTest {

    @Test
    void startsARunWithItsDatasetFingerprintWhileKeepingLegacyStartCompatible() {
        RecordingRunMapper runs = new RecordingRunMapper();
        TestRunLifecycleService lifecycle = new TestRunLifecycleService(runs, new RecordingResultMapper());
        TestRunRequest request = baseRequest();
        String fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

        TestRun fingerprinted = lifecycle.start(request, fingerprint);

        assertThat(fingerprinted.getDatasetFingerprint()).isEqualTo(fingerprint);

        RecordingRunMapper legacyRuns = new RecordingRunMapper();
        TestRun legacy = new TestRunLifecycleService(legacyRuns, new RecordingResultMapper()).start(request);
        assertThat(legacy.getDatasetFingerprint()).isNull();
    }

    @Test
    void rejectsAMissingSuiteBeforeCreatingItsRunRecord() {
        RecordingRunMapper runs = new RecordingRunMapper();
        TestSuiteService suites = mock(TestSuiteService.class);
        when(suites.get(404L)).thenThrow(new ResourceNotFoundException("TestSuite", 404L));
        TestRunService service = service(runs, mock(EvaluationService.class), suites);

        TestRunRequest request = baseRequest();
        request.setTestSuiteId(404L);

        assertThatThrownBy(() -> service.executeTest(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("TestSuite not found: 404");
        assertThat(runs.run).isNull();
    }

    @Test
    void rejectsAnEmptyPersistedSuiteBeforeCreatingItsRunRecord() {
        RecordingRunMapper runs = new RecordingRunMapper();
        TestSuite suite = new TestSuite();
        suite.setCases(List.of());
        TestSuiteService suites = mock(TestSuiteService.class);
        when(suites.get(5L)).thenReturn(suite);
        TestRunService service = service(runs, mock(EvaluationService.class), suites);

        TestRunRequest request = baseRequest();
        request.setTestSuiteId(5L);

        assertThatThrownBy(() -> service.executeTest(request))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("EMPTY_TEST_SUITE");
        assertThat(runs.run).isNull();
    }

    @Test
    void rejectsAPersistedSuiteWithNullCasesBeforeCreatingItsRunRecord() {
        RecordingRunMapper runs = new RecordingRunMapper();
        TestSuite suite = new TestSuite();
        suite.setCases(null);
        TestSuiteService suites = mock(TestSuiteService.class);
        when(suites.get(6L)).thenReturn(suite);
        TestRunService service = service(runs, mock(EvaluationService.class), suites);

        TestRunRequest request = baseRequest();
        request.setTestSuiteId(6L);

        assertThatThrownBy(() -> service.executeTest(request))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("EMPTY_TEST_SUITE");
        assertThat(runs.run).isNull();
    }

    @Test
    void marksAnAlreadyStartedRunFailedWhenBatchEvaluationCrashes() {
        RecordingRunMapper runs = new RecordingRunMapper();
        EvaluationService evaluation = mock(EvaluationService.class);
        when(evaluation.evaluate(anyString(), any(), anyString(), anyString()))
                .thenThrow(new IllegalStateException("batch executor crashed"));
        TestRunService service = service(runs, evaluation, null);

        TestRunRequest request = baseRequest();
        request.setTestInputs(List.of(Map.of("topic", "发布")));

        assertThatThrownBy(() -> service.executeTest(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("batch executor crashed");
        assertThat(runs.run).isNotNull();
        assertThat(runs.run.getStatus()).isEqualTo("FAILED");
        assertThat(runs.run.getCompletedAt()).isNotNull();
    }

    private static TestRunService service(
            RecordingRunMapper runs,
            EvaluationService evaluation,
            TestSuiteService suites
    ) {
        PromptService prompts = mock(PromptService.class);
        PromptVersion version = new PromptVersion();
        version.setId(10L);
        version.setContent("分析 {{topic}}");
        when(prompts.getVersion(10L)).thenReturn(version);
        return new TestRunService(
                prompts,
                evaluation,
                new TestRunLifecycleService(runs, new RecordingResultMapper()),
                new MetricsService(),
                suites,
                new DatasetFingerprintService()
        );
    }

    private static TestRunRequest baseRequest() {
        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(10L);
        request.setAiProvider("openai");
        request.setModelName("gpt-4o-mini");
        return request;
    }

    private static final class RecordingRunMapper implements TestRunMapper {

        private TestRun run;

        @Override
        public void insert(TestRun testRun) {
            testRun.setId(1L);
            testRun.setStartedAt(LocalDateTime.of(2026, 8, 13, 2, 0));
            run = testRun;
        }

        @Override
        public TestRun findById(Long id) {
            return run;
        }

        @Override
        public List<TestRun> findByPromptVersionId(Long promptVersionId) {
            return run == null ? List.of() : List.of(run);
        }

        @Override
        public void updateCompletion(Long id, String status) {
            run.setStatus(status);
            run.setCompletedAt(LocalDateTime.of(2026, 8, 13, 2, 1));
        }
    }

    private static final class RecordingResultMapper implements TestResultMapper {

        private final List<TestResult> results = new ArrayList<>();

        @Override
        public void insert(TestResult testResult) {
            results.add(testResult);
        }

        @Override
        public TestResult findById(Long id) {
            return null;
        }

        @Override
        public List<TestResult> findByTestRunId(Long testRunId) {
            return List.copyOf(results);
        }
    }
}

class TestSuiteRunExecutionTest {

    @Test
    void executesPersistedSuiteAndLinksRunToItsSource() {
        PromptService promptService = mock(PromptService.class);
        PromptVersion version = new PromptVersion();
        version.setId(10L);
        version.setContent("请输出 {{topic}} 的风险清单");
        when(promptService.getVersion(10L)).thenReturn(version);

        TestSuite suite = new TestSuite();
        suite.setId(5L);
        suite.setCases(List.of(new EvaluationCaseRequest(
                "发布风险",
                Map.of("topic", "发布"),
                List.of(new AssertionRule(AssertionType.CONTAINS, "不存在的文本", null))
        )));
        TestSuiteService suiteService = mock(TestSuiteService.class);
        when(suiteService.get(5L)).thenReturn(suite);

        TestRunMapper runMapper = mock(TestRunMapper.class);
        AtomicReference<TestRun> insertedRun = new AtomicReference<>();
        doAnswer(invocation -> {
            TestRun run = invocation.getArgument(0);
            run.setId(21L);
            insertedRun.set(run);
            return null;
        }).when(runMapper).insert(any(TestRun.class));
        TestRun completed = new TestRun();
        completed.setId(21L);
        completed.setPromptVersionId(10L);
        completed.setTestSuiteId(5L);
        completed.setAiProvider("openai");
        completed.setModelName("demo-model");
        completed.setStatus("FAILED");
        completed.setStartedAt(LocalDateTime.of(2026, 8, 10, 9, 0));
        when(runMapper.findById(21L)).thenAnswer(invocation -> {
            completed.setDatasetFingerprint(insertedRun.get().getDatasetFingerprint());
            return completed;
        });

        TestResultMapper resultMapper = mock(TestResultMapper.class);
        var execution = new AIExecutionService(true, TestChatModelResolver.unused(), new PromptTemplateService());
        var service = new TestRunService(
                promptService,
                new EvaluationService(execution, new AssertionEvaluationService()),
                new TestRunLifecycleService(runMapper, resultMapper),
                new MetricsService(),
                suiteService,
                new DatasetFingerprintService()
        );

        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(10L);
        request.setTestSuiteId(5L);
        request.setAiProvider("openai");
        request.setModelName("demo-model");

        var response = service.executeTest(request);

        assertThat(response.getTestSuiteId()).isEqualTo(5L);
        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getDatasetFingerprint())
                .isEqualTo("a7c3cf496fadeb2641bcfe8522445717d0f935feef32bc0847249c92cb586b19");
        assertThat(response.getResults()).singleElement().satisfies(result -> {
            assertThat(result.getCaseName()).isEqualTo("发布风险");
            assertThat(result.getErrorCode()).isEqualTo("ASSERTION_FAILED");
            assertThat(result.getAssertionResults()).hasSize(1);
        });
    }
}

class DatasetFingerprintServiceTest {

    private final DatasetFingerprintService fingerprints = new DatasetFingerprintService();

    @Test
    void fingerprintsTheCompleteOrderedCaseMatrixWithAStableSha256Digest() {
        List<EvaluationCaseRequest> cases = List.of(
                new EvaluationCaseRequest(
                        "退款检查",
                        linkedVariables("tone", "专业", "topic", "退款"),
                        List.of(
                                new AssertionRule(AssertionType.CONTAINS, "已处理", null),
                                new AssertionRule(AssertionType.MIN_QUALITY_SCORE, null, 0.80)
                        )
                ),
                new EvaluationCaseRequest(null, Map.of("topic", "账单"), List.of())
        );

        assertThat(fingerprints.fingerprintCases(cases))
                .isEqualTo("d546e2b26cd9b28eae0297cd9f2c4447e93995531f90a06403aba7dcd4781eec");
    }

    @Test
    void ignoresMapIterationOrderAndNormalizesEquivalentThresholds() {
        Map<String, String> firstVariables = linkedVariables("z", "末尾", "a", "开头");
        Map<String, String> secondVariables = linkedVariables("a", "开头", "z", "末尾");
        EvaluationCaseRequest first = new EvaluationCaseRequest(
                "case", firstVariables,
                List.of(new AssertionRule(AssertionType.MAX_LATENCY_MS, null, 1000.0))
        );
        EvaluationCaseRequest second = new EvaluationCaseRequest(
                "case", secondVariables,
                List.of(new AssertionRule(AssertionType.MAX_LATENCY_MS, null, 1.0e3))
        );

        assertThat(fingerprints.fingerprintCases(List.of(first)))
                .isEqualTo(fingerprints.fingerprintCases(List.of(second)));
    }

    @Test
    void distinguishesNullFromEmptyAndPreservesCaseAndAssertionOrder() {
        EvaluationCaseRequest nullName = new EvaluationCaseRequest(null, Map.of("value", ""), List.of(
                new AssertionRule(AssertionType.CONTAINS, "A", null),
                new AssertionRule(AssertionType.NOT_CONTAINS, "B", null)
        ));
        EvaluationCaseRequest emptyName = new EvaluationCaseRequest("", Map.of("value", ""), List.of(
                new AssertionRule(AssertionType.CONTAINS, "A", null),
                new AssertionRule(AssertionType.NOT_CONTAINS, "B", null)
        ));
        EvaluationCaseRequest reversedAssertions = new EvaluationCaseRequest(null, Map.of("value", ""), List.of(
                new AssertionRule(AssertionType.NOT_CONTAINS, "B", null),
                new AssertionRule(AssertionType.CONTAINS, "A", null)
        ));

        String baseline = fingerprints.fingerprintCases(List.of(nullName, emptyName));

        assertThat(fingerprints.fingerprintCases(List.of(emptyName, nullName))).isNotEqualTo(baseline);
        assertThat(fingerprints.fingerprintCases(List.of(nullName, nullName))).isNotEqualTo(baseline);
        assertThat(fingerprints.fingerprintCases(List.of(reversedAssertions, emptyName))).isNotEqualTo(baseline);
    }

    @Test
    void fingerprintsNullAndDirtyCasesDeterministicallyInsteadOfCrashing() {
        Map<String, String> dirtyVariables = new HashMap<>();
        dirtyVariables.put(null, null);
        dirtyVariables.put("empty", "");
        List<AssertionRule> dirtyAssertions = new ArrayList<>();
        dirtyAssertions.add(null);
        dirtyAssertions.add(new AssertionRule(null, null, Double.NaN));
        List<EvaluationCaseRequest> dirtyCases = new ArrayList<>();
        dirtyCases.add(null);
        dirtyCases.add(new EvaluationCaseRequest(null, dirtyVariables, dirtyAssertions));

        String first = fingerprints.fingerprintCases(dirtyCases);

        assertThat(first).matches("[0-9a-f]{64}");
        assertThat(fingerprints.fingerprintCases(dirtyCases)).isEqualTo(first);
        assertThat(fingerprints.fingerprintCases(null)).matches("[0-9a-f]{64}");
    }

    @Test
    void legacyInputsMatchEquivalentCasesWithoutNamesOrAssertions() {
        List<Map<String, String>> legacy = List.of(
                linkedVariables("tone", "专业", "topic", "退款"),
                Map.of("topic", "账单")
        );
        List<EvaluationCaseRequest> equivalentCases = List.of(
                new EvaluationCaseRequest(null, legacy.get(0), List.of()),
                new EvaluationCaseRequest(null, legacy.get(1), List.of())
        );

        assertThat(fingerprints.fingerprintLegacyInputs(legacy))
                .isEqualTo(fingerprints.fingerprintCases(equivalentCases));
    }

    private static Map<String, String> linkedVariables(String... entries) {
        Map<String, String> variables = new LinkedHashMap<>();
        for (int index = 0; index < entries.length; index += 2) {
            variables.put(entries[index], entries[index + 1]);
        }
        return variables;
    }
}
