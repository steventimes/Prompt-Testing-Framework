package com.promptframework.service;

import com.promptframework.exception.PromptExecutionException;
import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.AssertionType;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.QuickTestRequest;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.output.TokenUsage;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 测试专用解析器，明确区分“不应调用”“未配置”和固定模型三种边界。
 */
final class TestChatModelResolver {

    private TestChatModelResolver() {
    }

    static ChatModelResolver unused() {
        return (provider, modelName) -> {
            throw new AssertionError("Mock 模式不应解析真实模型");
        };
    }

    static ChatModelResolver unconfigured() {
        return (provider, modelName) -> {
            throw new PromptExecutionException("PROVIDER_NOT_CONFIGURED", "实时模式未配置可用的模型凭据");
        };
    }

    static ChatModelResolver returning(ChatModel model) {
        return (provider, modelName) -> model;
    }
}

class PromptTemplateServiceTest {

    private final PromptTemplateService service = new PromptTemplateService();

    @Test
    void extractsVariablesInFirstSeenOrderAndRemovesDuplicates() {
        var analysis = service.analyze(
                "你好 {{ customer }}，订单 {orderId}，再次确认 {{customer}}。",
                Map.of()
        );

        assertThat(analysis.variables()).containsExactly("customer", "orderId");
        assertThat(analysis.missingVariables()).containsExactly("customer", "orderId");
        assertThat(analysis.complete()).isFalse();
    }

    @Test
    void rendersBothPlaceholderStylesWithoutTreatingReplacementAsRegex() {
        var analysis = service.analyze(
                "客户={{customer}}；路径={path}",
                Map.of("customer", "$5", "path", "C:\\temp\\file")
        );

        assertThat(analysis.renderedContent()).isEqualTo("客户=$5；路径=C:\\temp\\file");
        assertThat(analysis.missingVariables()).isEmpty();
        assertThat(analysis.complete()).isTrue();
    }

    @Test
    void leavesOnlyMissingPlaceholdersUnresolved() {
        var analysis = service.analyze(
                "主题 {{topic}}，语气 {{ tone }}",
                Map.of("topic", "退款")
        );

        assertThat(analysis.renderedContent()).isEqualTo("主题 退款，语气 {{ tone }}");
        assertThat(analysis.missingVariables()).containsExactly("tone");
    }

    @Test
    void acceptsTemplatesWithoutVariables() {
        var analysis = service.analyze("返回固定 JSON。", Map.of());

        assertThat(analysis.variables()).isEqualTo(List.of());
        assertThat(analysis.renderedContent()).isEqualTo("返回固定 JSON。");
        assertThat(analysis.complete()).isTrue();
    }
}

class QualityScoreParserTest {

    private final QualityScoreParser parser = new QualityScoreParser();

    @ParameterizedTest
    @CsvSource({
            "0, 0.0",
            "1, 1.0",
            "0.91, 0.91",
            "1.0, 1.0",
            "1.00, 1.0",
            "'  0.25  ', 0.25"
    })
    void parsesOnlyCompleteDecimalScoresWithinTheAllowedRange(String rawScore, double expectedScore) {
        assertThat(parser.parse(rawScore)).isEqualTo(expectedScore);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   ", "1.25", "10/10", "score=0.9", "NaN", "Infinity", "-0.1", ".5", "0.", "1.00x"})
    void rejectsNonCanonicalOrOutOfRangeJudgeOutput(String rawScore) {
        assertThat(parser.parse(rawScore)).isNull();
    }
}

class ConfiguredChatModelResolverTest {

    @Test
    void normalizesCoordinatesAndCachesOneClientPerProviderAndModel() {
        List<String> creations = new ArrayList<>();
        ChatModelFactory factory = (provider, modelName, apiKey) -> {
            creations.add(provider + ":" + modelName + ":" + apiKey);
            return mock(ChatModel.class);
        };
        var resolver = new ConfiguredChatModelResolver(factory, "open-key", "anthropic-key");

        ChatModel first = resolver.resolve(" OpenAI ", " gpt-4o-mini ");
        ChatModel repeated = resolver.resolve("openai", "gpt-4o-mini");
        ChatModel anthropic = resolver.resolve("ANTHROPIC", "claude-sonnet-4-5");

        assertThat(repeated).isSameAs(first);
        assertThat(anthropic).isNotSameAs(first);
        assertThat(creations).containsExactly(
                "openai:gpt-4o-mini:open-key",
                "anthropic:claude-sonnet-4-5:anthropic-key"
        );
    }

    @Test
    void rejectsUnsupportedProvidersAndMissingCredentialsBeforeBuildingAClient() {
        List<String> creations = new ArrayList<>();
        ChatModelFactory factory = (provider, modelName, apiKey) -> {
            creations.add(provider);
            return mock(ChatModel.class);
        };
        var resolver = new ConfiguredChatModelResolver(factory, "", "anthropic-key");

        assertThatThrownBy(() -> resolver.resolve("azure", "gpt-4o"))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("PROVIDER_NOT_SUPPORTED");
        assertThatThrownBy(() -> resolver.resolve("openai", "gpt-4o"))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("PROVIDER_NOT_CONFIGURED");
        assertThatThrownBy(() -> resolver.resolve("anthropic", "  "))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("MODEL_NAME_INVALID");
        assertThat(creations).isEmpty();
    }
}

class ConfiguredChatModelResolverCacheTest {

    @Test
    void evictsOldClientsAfterManyDistinctModelCoordinates() {
        AtomicInteger creations = new AtomicInteger();
        ChatModelFactory factory = (provider, modelName, apiKey) -> {
            creations.incrementAndGet();
            return mock(ChatModel.class);
        };
        var resolver = new ConfiguredChatModelResolver(factory, "open-key", "anthropic-key");

        ChatModel oldest = resolver.resolve("openai", "model-0");
        for (int index = 1; index < 40; index++) {
            resolver.resolve("openai", "model-" + index);
        }
        ChatModel reloaded = resolver.resolve("openai", "model-0");

        assertThat(reloaded).isNotSameAs(oldest);
        assertThat(creations).hasValue(41);
    }
}

class AIExecutionServiceTest {

    private final PromptTemplateService templateService = new PromptTemplateService();

    @Test
    void mockExecutionUsesRenderedPromptAndProducesRepeatableMetrics() {
        AIExecutionService service = new AIExecutionService(true, TestChatModelResolver.unused(), templateService);

        var first = service.execute(
                "请处理 {{topic}}，客户为 {customer}",
                Map.of("topic", "退款", "customer", "$5\\test"),
                "openai",
                "demo-model"
        );
        var second = service.execute(
                "请处理 {{topic}}，客户为 {customer}",
                Map.of("topic", "退款", "customer", "$5\\test"),
                "openai",
                "demo-model"
        );

        assertThat(first.getResponseText()).contains("退款", "$5\\test").doesNotContain("{{topic}}");
        assertThat(first.getResponseTimeMs()).isEqualTo(second.getResponseTimeMs());
        assertThat(first.getQualityScore()).isEqualTo(second.getQualityScore());
        assertThat(first.isMock()).isTrue();
    }

    @Test
    void rejectsExecutionWhenTemplateVariablesAreMissing() {
        AIExecutionService service = new AIExecutionService(true, TestChatModelResolver.unused(), templateService);

        assertThatThrownBy(() -> service.execute(
                "主题 {{topic}}，语气 {{tone}}",
                Map.of("topic", "账单"),
                "openai",
                "demo-model"
        ))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("PROMPT_VARIABLES_MISSING");
    }

    @Test
    void liveModeNeverSilentlyFallsBackToMock() {
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.unconfigured(), templateService);

        assertThatThrownBy(() -> service.execute("固定内容", Map.of(), "openai", "gpt-live"))
                .isInstanceOf(PromptExecutionException.class)
                .extracting(error -> ((PromptExecutionException) error).getCode())
                .isEqualTo("PROVIDER_NOT_CONFIGURED");
    }

    @Test
    void providerFailureIsReportedAsFailureInsteadOfSuccessfulErrorText() {
        ChatModel model = mock(ChatModel.class);
        IllegalStateException upstreamFailure = new IllegalStateException("upstream timeout");
        when(model.chat(anyString())).thenThrow(upstreamFailure);
        when(model.chat(any(ChatMessage[].class))).thenThrow(upstreamFailure);
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.returning(model), templateService);

        assertThatThrownBy(() -> service.execute("固定内容", Map.of(), "openai", "gpt-live"))
                .isInstanceOf(PromptExecutionException.class)
                .hasMessageContaining("模型调用失败")
                .hasCauseInstanceOf(IllegalStateException.class);
    }

    @Test
    void liveExecutionUsesBothActualUsageTotalsAndLeavesCostUnknown() {
        ChatModel model = mock(ChatModel.class);
        when(model.chat(anyString())).thenReturn("fallback answer", "0.91");
        when(model.chat(any(ChatMessage[].class))).thenReturn(
                response("模型回答", 17),
                response("0.91", 3));
        var resolvedCoordinates = new ArrayList<String>();
        ChatModelResolver resolver = (provider, modelName) -> {
            resolvedCoordinates.add(provider + ":" + modelName);
            return model;
        };
        AIExecutionService service = new AIExecutionService(false, resolver, templateService);

        var response = service.execute("固定内容", Map.of(), "anthropic", "claude-sonnet-4-5");

        assertThat(resolvedCoordinates).containsExactly("anthropic:claude-sonnet-4-5");
        assertThat(response.getResponseText()).isEqualTo("模型回答");
        assertThat(response.getProvider()).isEqualTo("anthropic");
        assertThat(response.getModel()).isEqualTo("claude-sonnet-4-5");
        assertThat(response.getQualityScore()).isEqualTo(0.91);
        assertThat(response.getTokenCount()).isEqualTo(20);
        assertThat(response.getCostUsd()).isNull();
    }

    @Test
    void liveExecutionKeepsJudgeUsageWhenItsScoreIsInvalid() {
        ChatModel model = mock(ChatModel.class);
        when(model.chat(anyString())).thenReturn("fallback answer", "score=0.91");
        when(model.chat(any(ChatMessage[].class))).thenReturn(
                response("模型回答", 17),
                response("score=0.91", 3));
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.returning(model), templateService);

        var response = service.execute("固定内容", Map.of(), "openai", "gpt-live");

        assertThat(response.getQualityScore()).isNull();
        assertThat(response.getTokenCount()).isEqualTo(20);
        assertThat(response.getCostUsd()).isNull();
    }

    @Test
    void liveExecutionLeavesTotalTokensUnknownWhenJudgeFails() {
        ChatModel model = mock(ChatModel.class);
        when(model.chat(anyString())).thenReturn("fallback answer").thenThrow(new IllegalStateException("judge timeout"));
        when(model.chat(any(ChatMessage[].class))).thenReturn(response("模型回答", 17))
                .thenThrow(new IllegalStateException("judge timeout"));
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.returning(model), templateService);

        var response = service.execute("固定内容", Map.of(), "openai", "gpt-live");

        assertThat(response.getResponseText()).isEqualTo("模型回答");
        assertThat(response.getQualityScore()).isNull();
        assertThat(response.getTokenCount()).isNull();
        assertThat(response.getCostUsd()).isNull();
    }

    @Test
    void liveExecutionLeavesTotalTokensUnknownWhenJudgeUsageIsMissing() {
        ChatModel model = mock(ChatModel.class);
        when(model.chat(anyString())).thenReturn("fallback answer", "0.91");
        when(model.chat(any(ChatMessage[].class))).thenReturn(
                response("模型回答", 17),
                ChatResponse.builder().aiMessage(AiMessage.from("0.91")).build());
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.returning(model), templateService);

        var response = service.execute("固定内容", Map.of(), "openai", "gpt-live");

        assertThat(response.getQualityScore()).isEqualTo(0.91);
        assertThat(response.getTokenCount()).isNull();
        assertThat(response.getCostUsd()).isNull();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"1.25", "10", "score=0.9", "NaN", "Infinity", "   "})
    void liveExecutionLeavesQualityScoreNullForInvalidJudgeOutput(String invalidJudgeOutput) {
        ChatModel model = mock(ChatModel.class);
        String judgeResponseText = invalidJudgeOutput == null ? "" : invalidJudgeOutput;
        when(model.chat(anyString())).thenReturn("fallback answer", invalidJudgeOutput);
        when(model.chat(any(ChatMessage[].class))).thenReturn(
                response("模型回答", 17), response(judgeResponseText, 3));
        AIExecutionService service = new AIExecutionService(false, TestChatModelResolver.returning(model), templateService);

        var response = service.execute("固定内容", Map.of(), "openai", "gpt-live");

        assertThat(response.getResponseText()).isEqualTo("模型回答");
        assertThat(response.getQualityScore()).isNull();
        assertThat(response.getTokenCount()).isEqualTo(20);
    }

    @Test
    void privacySignalsAreAttachedToEachExecution() {
        AIExecutionService service = new AIExecutionService(true, TestChatModelResolver.unused(), templateService);

        var result = service.execute(
                "联系邮箱 {{email}}，令牌 {{token}}",
                Map.of("email", "owner@example.com", "token", "sk-1234567890abcdef"),
                "openai",
                "demo-model"
        );

        assertThat(result.getPrivacySummary().getFlags()).contains("email", "api-key");
        assertThat(result.getPrivacySummary().getRiskScore()).isEqualTo(0.8);
    }

    private ChatResponse response(String text, int totalTokens) {
        return ChatResponse.builder()
                .aiMessage(AiMessage.from(text))
                .tokenUsage(new TokenUsage(totalTokens))
                .build();
    }
}

class AssertionEvaluationServiceTest {

    private final AssertionEvaluationService service = new AssertionEvaluationService();

    @Test
    void evaluatesContentStructureAndNumericThresholdsWithoutShortCircuiting() {
        var evaluation = service.evaluate(
                "{\"summary\":\"结论：可以发布\"}",
                420,
                new BigDecimal("0.0012"),
                0.86,
                List.of(
                        new AssertionRule(AssertionType.CONTAINS, "结论", null),
                        new AssertionRule(AssertionType.NOT_CONTAINS, "抱歉", null),
                        new AssertionRule(AssertionType.REGEX, "发布$", null),
                        new AssertionRule(AssertionType.JSON_VALID, null, null),
                        new AssertionRule(AssertionType.MAX_LATENCY_MS, null, 500.0),
                        new AssertionRule(AssertionType.MAX_COST_USD, null, 0.002),
                        new AssertionRule(AssertionType.MIN_QUALITY_SCORE, null, 0.80)
                )
        );

        assertThat(evaluation.passed()).isFalse();
        assertThat(evaluation.results()).hasSize(7);
        assertThat(evaluation.results()).extracting("passed")
                .containsExactly(true, true, false, true, true, true, true);
        assertThat(evaluation.results().get(2).message()).contains("正则");
    }

    @Test
    void invalidRegexAndMissingThresholdBecomeFailedEvidenceInsteadOfExceptions() {
        var evaluation = service.evaluate(
                "plain text",
                10,
                BigDecimal.ZERO,
                0.5,
                List.of(
                        new AssertionRule(AssertionType.REGEX, "[", null),
                        new AssertionRule(AssertionType.MAX_LATENCY_MS, null, null)
                )
        );

        assertThat(evaluation.passed()).isFalse();
        assertThat(evaluation.results()).allSatisfy(result -> {
            assertThat(result.passed()).isFalse();
            assertThat(result.message()).isNotBlank();
        });
    }

    @Test
    void emptyRulesAreAValidPassingEvaluation() {
        var evaluation = service.evaluate("anything", 0, BigDecimal.ZERO, 0.0, List.of());

        assertThat(evaluation.passed()).isTrue();
        assertThat(evaluation.results()).isEmpty();
    }

    @Test
    void unavailableQualityScoreFailsMinimumQualityAssertionWithAnExplicitMessage() {
        var evaluation = service.evaluate(
                "anything",
                0,
                BigDecimal.ZERO,
                null,
                List.of(new AssertionRule(AssertionType.MIN_QUALITY_SCORE, null, 0.80))
        );

        assertThat(evaluation.passed()).isFalse();
        assertThat(evaluation.results()).singleElement().satisfies(result -> {
            assertThat(result.passed()).isFalse();
            assertThat(result.actual()).isNull();
            assertThat(result.message()).contains("质量分不可用");
            assertThat(result.message()).doesNotContain("低于质量下限");
        });
    }
}

class EvaluationCaseExecutionTest {

    private final EvaluationService service = new EvaluationService(
            new AIExecutionService(true, TestChatModelResolver.unused(), new PromptTemplateService()),
            new AssertionEvaluationService()
    );

    @Test
    void assertionFailureKeepsGeneratedOutputAndAllAssertionEvidence() {
        var results = service.evaluateCases(
                "请总结 {{topic}}",
                List.of(new EvaluationCaseRequest(
                        "必须给出风险",
                        Map.of("topic", "发布计划"),
                        List.of(
                                new AssertionRule(AssertionType.CONTAINS, "发布计划", null),
                                new AssertionRule(AssertionType.CONTAINS, "风险清单", null)
                        )
                )),
                "openai",
                "demo-model"
        );

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.getCaseName()).isEqualTo("必须给出风险");
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorCode()).isEqualTo("ASSERTION_FAILED");
            assertThat(result.getAiResponse()).contains("发布计划");
            assertThat(result.getAssertionPassed()).isFalse();
            assertThat(result.getAssertionResults()).extracting("passed")
                    .containsExactly(true, false);
        });
    }

    @Test
    void executionFailureDoesNotAttemptAssertionsButKeepsCaseIdentity() {
        var results = service.evaluateCases(
                "请总结 {{topic}} 和 {{audience}}",
                List.of(new EvaluationCaseRequest(
                        "缺变量样本",
                        Map.of("topic", "发布计划"),
                        List.of(new AssertionRule(AssertionType.CONTAINS, "结论", null))
                )),
                "openai",
                "demo-model"
        );

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.getCaseName()).isEqualTo("缺变量样本");
            assertThat(result.getErrorCode()).isEqualTo("PROMPT_VARIABLES_MISSING");
            assertThat(result.getAssertionPassed()).isNull();
            assertThat(result.getAssertionResults()).isEmpty();
        });
    }

    @Test
    void invalidNullCaseKeepsFailureEvidenceAndContinuesWithFollowingCase() {
        List<EvaluationCaseRequest> cases = new ArrayList<>();
        cases.add(null);
        cases.add(new EvaluationCaseRequest(
                "后续合法用例",
                Map.of("topic", "发布计划"),
                List.of()
        ));

        var results = service.evaluateCases("请总结 {{topic}}", cases, "openai", "demo-model");

        assertThat(results).hasSize(2);
        assertThat(results.get(0)).satisfies(result -> {
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorCode()).isEqualTo("INVALID_TEST_CASE");
            assertThat(result.getErrorMessage()).doesNotContain("NullPointerException");
            assertThat(result.getInputVariables()).isEmpty();
            assertThat(result.getAssertionResults()).isEmpty();
        });
        assertThat(results.get(1).getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void nullVariableValueKeepsImmutableFailureSnapshotAndContinuesWithFollowingCase() {
        Map<String, String> invalidVariables = new HashMap<>();
        invalidVariables.put("topic", null);
        List<EvaluationCaseRequest> cases = List.of(
                new EvaluationCaseRequest("空变量值", invalidVariables, List.of()),
                new EvaluationCaseRequest("后续合法用例", Map.of("topic", "发布计划"), List.of())
        );

        var results = service.evaluateCases("请总结 {{topic}}", cases, "openai", "demo-model");
        invalidVariables.put("topic", "后续篡改");

        assertThat(results).hasSize(2);
        assertThat(results.get(0)).satisfies(result -> {
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorCode()).isEqualTo("INVALID_TEST_CASE");
            assertThat(result.getErrorMessage()).doesNotContain("NullPointerException");
            assertThat(result.getInputVariables()).containsEntry("topic", null);
            assertThat(result.getAssertionResults()).isEmpty();
            assertThatThrownBy(() -> result.getInputVariables().put("other", "value"))
                    .isInstanceOf(UnsupportedOperationException.class);
        });
        assertThat(results.get(1).getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void nullVariablesMapIsReportedAsInvalidTestCaseWithImmutableEmptyEvidenceAndContinues() {
        List<EvaluationCaseRequest> cases = List.of(
                new EvaluationCaseRequest("变量映射缺失", null, List.of()),
                new EvaluationCaseRequest("后续合法用例", Map.of("topic", "发布计划"), List.of())
        );

        var results = service.evaluateCases("请总结 {{topic}}", cases, "openai", "demo-model");

        assertThat(results).hasSize(2);
        assertThat(results.get(0)).satisfies(result -> {
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorCode()).isEqualTo("INVALID_TEST_CASE");
            assertThat(result.getInputVariables()).isEmpty();
            assertThatThrownBy(() -> result.getInputVariables().put("topic", "篡改"))
                    .isInstanceOf(UnsupportedOperationException.class);
        });
        assertThat(results.get(1).getStatus()).isEqualTo("COMPLETED");
    }
}

class EvaluationServiceTest {

    private final EvaluationService service = new EvaluationService(
            new AIExecutionService(true, TestChatModelResolver.unused(), new PromptTemplateService())
    );

    @Test
    void evaluatesEveryCaseAndKeepsSuccessAndFailureEvidenceInOrder() {
        var results = service.evaluate(
                "主题 {{topic}}，邮箱 {{email}}",
                List.of(
                        Map.of("topic", "退款", "email", "owner@example.com"),
                        Map.of("topic", "账单")
                ),
                "openai",
                "demo-model"
        );

        assertThat(results).hasSize(2);
        assertThat(results.get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(results.get(0).getInputVariables()).containsEntry("topic", "退款");
        assertThat(results.get(0).getPrivacyFlags()).contains("email");
        assertThat(results.get(0).getMcpCalls()).isNotEmpty();
        assertThat(results.get(1).getStatus()).isEqualTo("FAILED");
        assertThat(results.get(1).getErrorCode()).isEqualTo("PROMPT_VARIABLES_MISSING");
        assertThat(results.get(1).getInputVariables()).isEqualTo(Map.of("topic", "账单"));
    }

    @Test
    void persistsUnknownLiveCostAndKnownUsageWithoutTreatingItAsAnExecutionFailure() {
        ChatModel model = mock(ChatModel.class);
        when(model.chat(any(ChatMessage[].class))).thenReturn(
                response("模型回答", 11), response("0.9", 2));
        EvaluationService liveService = new EvaluationService(
                new AIExecutionService(false, TestChatModelResolver.returning(model), new PromptTemplateService())
        );

        var results = liveService.evaluate("固定内容", List.of(Map.of()), "openai", "gpt-live");

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.getStatus()).isEqualTo("COMPLETED");
            assertThat(result.getTokenCount()).isEqualTo(13);
            assertThat(result.getCostUsd()).isNull();
        });
    }

    @Test
    void returnsEmptyResultForEmptyCaseList() {
        assertThat(service.evaluate("固定内容", List.of(), "openai", "demo-model")).isEmpty();
    }

    @Test
    void legacyNullInputIsReportedAsInvalidTestCaseInsteadOfBeingConvertedToEmptyVariables() {
        List<Map<String, String>> inputs = new ArrayList<>();
        inputs.add(null);
        inputs.add(Map.of("topic", "发布计划"));

        var results = service.evaluate("请总结 {{topic}}", inputs, "openai", "demo-model");

        assertThat(results).hasSize(2);
        assertThat(results.get(0)).satisfies(result -> {
            assertThat(result.getStatus()).isEqualTo("FAILED");
            assertThat(result.getErrorCode()).isEqualTo("INVALID_TEST_CASE");
            assertThat(result.getInputVariables()).isEmpty();
        });
        assertThat(results.get(1).getStatus()).isEqualTo("COMPLETED");
    }

    private ChatResponse response(String text, int totalTokens) {
        return ChatResponse.builder()
                .aiMessage(AiMessage.from(text))
                .tokenUsage(new TokenUsage(totalTokens))
                .build();
    }
}

class QuickTestServiceTest {

    @Test
    void returnsCompleteEnvelopeAndKeepsFailedCasesVisible() {
        Clock clock = Clock.fixed(Instant.parse("2026-08-10T08:30:00Z"), ZoneOffset.UTC);
        AIExecutionService execution = new AIExecutionService(true, TestChatModelResolver.unused(), new PromptTemplateService());
        QuickTestService service = new QuickTestService(
                new EvaluationService(execution),
                new MetricsService(),
                clock
        );
        QuickTestRequest request = new QuickTestRequest();
        request.setPromptContent("主题 {{topic}}，语气 {{tone}}");
        request.setAiProvider("openai");
        request.setModelName("demo-model");
        request.setTestInputs(List.of(
                Map.of("topic", "退款", "tone", "克制"),
                Map.of("topic", "账单")
        ));

        var response = service.execute(request);

        assertThat(response.getId()).isNotBlank();
        assertThat(response.getExecutedAt()).isEqualTo(Instant.parse("2026-08-10T08:30:00Z"));
        assertThat(response.getStatus()).isEqualTo("PARTIAL");
        assertThat(response.getResults()).hasSize(2);
        assertThat(response.getResults().get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(response.getResults().get(1).getStatus()).isEqualTo("FAILED");
        assertThat(response.getResults().get(1).getErrorCode()).isEqualTo("PROMPT_VARIABLES_MISSING");
        assertThat(response.getMetrics().getCompletedCases()).isEqualTo(1);
        assertThat(response.getMetrics().getFailedCases()).isEqualTo(1);
        assertThat(response.getMetrics().getQualityScoredCases()).isEqualTo(1);
        assertThat(response.getMetrics().getQualityCoverage()).isEqualTo(1.0);
    }
}

class QuickTestAssertionsTest {

    @Test
    void exposesAssertionEvidenceAndAggregatePassRate() {
        var execution = new AIExecutionService(true, TestChatModelResolver.unused(), new PromptTemplateService());
        var service = new QuickTestService(
                new EvaluationService(execution, new AssertionEvaluationService()),
                new MetricsService(),
                Clock.fixed(Instant.parse("2026-08-10T09:00:00Z"), ZoneOffset.UTC)
        );

        QuickTestRequest request = new QuickTestRequest();
        request.setPromptContent("分析 {{topic}}");
        request.setAiProvider("openai");
        request.setModelName("demo-model");
        request.setTestCases(List.of(new EvaluationCaseRequest(
                "必须给出结论",
                Map.of("topic", "发布风险"),
                List.of(new AssertionRule(AssertionType.CONTAINS, "绝不会出现的断言文本", null))
        )));

        var response = service.execute(request);

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getResults()).singleElement().satisfies(result -> {
            assertThat(result.getCaseName()).isEqualTo("必须给出结论");
            assertThat(result.getAssertionPassed()).isFalse();
            assertThat(result.getAssertionResults()).singleElement()
                    .satisfies(assertion -> assertThat(assertion.passed()).isFalse());
        });
        assertThat(response.getMetrics().getTotalAssertions()).isEqualTo(1);
        assertThat(response.getMetrics().getPassedAssertions()).isZero();
        assertThat(response.getMetrics().getFailedAssertions()).isEqualTo(1);
        assertThat(response.getMetrics().getAssertionPassRate()).isZero();
    }
}
