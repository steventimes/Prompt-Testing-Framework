package com.promptframework.controller;

import com.promptframework.config.AssertionResultListTypeHandler;
import com.promptframework.config.EvaluationCaseListTypeHandler;
import com.promptframework.config.JsonMapTypeHandler;
import com.promptframework.config.JsonStringListTypeHandler;
import com.promptframework.config.McpToolCallListTypeHandler;
import com.promptframework.exception.GlobalExceptionHandler;
import com.promptframework.exception.PromptExecutionException;
import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.model.dto.ApiErrorResponse;
import com.promptframework.model.dto.AssertionResult;
import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.AssertionType;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.McpToolCall;
import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.RegressionGateRequest;
import com.promptframework.model.dto.RegressionGateResponse;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestSuiteUpsertRequest;
import com.promptframework.model.entity.TestSuite;
import com.promptframework.service.PromptService;
import com.promptframework.service.RegressionGateService;
import com.promptframework.service.TestRunService;
import com.promptframework.service.TestSuiteService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.lang.reflect.Method;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsPromptExecutionCodesToActionableStatuses() {
        assertExecutionStatus("PROMPT_VARIABLES_MISSING", HttpStatus.UNPROCESSABLE_ENTITY);
        assertExecutionStatus("PROVIDER_NOT_CONFIGURED", HttpStatus.SERVICE_UNAVAILABLE);
        assertExecutionStatus("PROVIDER_EXECUTION_FAILED", HttpStatus.BAD_GATEWAY);
        assertExecutionStatus("PROVIDER_EMPTY_RESPONSE", HttpStatus.BAD_GATEWAY);
    }

    @Test
    void hidesUnexpectedExceptionDetails() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/test-runs/1");

        ResponseEntity<ApiErrorResponse> response = handler.handleUnexpected(
                new IllegalStateException("database password was exposed"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(response.getBody().message()).isEqualTo("Unexpected server error");
        assertThat(response.getBody().message()).doesNotContain("password");
    }

    private void assertExecutionStatus(String code, HttpStatus expectedStatus) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/quick-test");
        PromptExecutionException exception = new PromptExecutionException(code, "provider failed");

        ResponseEntity<ApiErrorResponse> response = handler.handlePromptExecution(exception, request);

        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(code);
        assertThat(response.getBody().path()).isEqualTo("/api/quick-test");
    }
}

class EvaluationJsonTypeHandlersTest {

    @Test
    void assertionEvidenceRestoresTypedResultsInOriginalOrder() throws Exception {
        AssertionResultListTypeHandler handler = new AssertionResultListTypeHandler();
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("assertion_results")).thenReturn("""
                [
                  {"type":"CONTAINS","passed":true,"expected":"发布","actual":"发布成功","message":"通过"},
                  {"type":"MAX_LATENCY_MS","passed":false,"expected":"≤ 500 ms","actual":"620","message":"超时"}
                ]
                """);

        assertThat(handler.getNullableResult(resultSet, "assertion_results"))
                .containsExactly(
                        new AssertionResult(AssertionType.CONTAINS, true, "发布", "发布成功", "通过"),
                        new AssertionResult(AssertionType.MAX_LATENCY_MS, false,
                                "≤ 500 ms", "620", "超时")
                );
    }

    @Test
    void suiteCasesRestoreVariablesAndRulesAsTypedRecords() throws Exception {
        EvaluationCaseListTypeHandler handler = new EvaluationCaseListTypeHandler();
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("cases")).thenReturn("""
                [{
                  "name":"基础用例",
                  "variables":{"topic":"发布"},
                  "assertions":[{"type":"CONTAINS","value":"发布"}]
                }]
                """);

        assertThat(handler.getNullableResult(resultSet, "cases")).singleElement().satisfies(testCase -> {
            assertThat(testCase.name()).isEqualTo("基础用例");
            assertThat(testCase.variables()).containsEntry("topic", "发布");
            assertThat(testCase.assertions()).singleElement()
                    .extracting("type", "value")
                    .containsExactly(AssertionType.CONTAINS, "发布");
        });
    }
}

class JsonTypeHandlersTest {

    @Test
    void mapHandlerWritesJsonbAndRestoresStringMap() throws Exception {
        JsonMapTypeHandler handler = new JsonMapTypeHandler();
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("input_variables")).thenReturn("{\"question\":\"退款\",\"tier\":\"vip\"}");

        handler.setNonNullParameter(
                statement,
                1,
                Map.of("question", "退款", "tier", "vip"),
                JdbcType.OTHER
        );

        var captor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(statement).setObject(eq(1), captor.capture());
        PGobject stored = (PGobject) captor.getValue();
        assertThat(stored.getType()).isEqualTo("jsonb");
        assertThat(stored.getValue()).contains("\"question\":\"退款\"");
        assertThat(handler.getNullableResult(resultSet, "input_variables"))
                .isEqualTo(Map.of("question", "退款", "tier", "vip"));
    }

    @Test
    void stringListHandlerRestoresPrivacyFlags() throws Exception {
        JsonStringListTypeHandler handler = new JsonStringListTypeHandler();
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString(3)).thenReturn("[\"email\",\"api-key\"]");

        assertThat(handler.getNullableResult(resultSet, 3)).containsExactly("email", "api-key");
    }

    @Test
    void mcpCallListHandlerRestoresStructuredTrace() throws Exception {
        McpToolCallListTypeHandler handler = new McpToolCallListTypeHandler();
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("mcp_calls")).thenReturn(
                "[{\"toolName\":\"mcp.prompt.resolve\",\"durationMs\":12,\"status\":\"ok\",\"dataAccess\":\"template\"}]"
        );

        assertThat(handler.getNullableResult(resultSet, "mcp_calls"))
                .containsExactly(new McpToolCall("mcp.prompt.resolve", 12, "ok", "template"));
    }

    @Test
    void handlersReturnNullForDatabaseNull() throws Exception {
        JsonMapTypeHandler handler = new JsonMapTypeHandler();
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("payload")).thenReturn(null);

        assertThat(handler.getNullableResult(resultSet, "payload")).isNull();
    }
}

class RequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void rejectsAiProvidersLongerThanDatabaseColumn() {
        TestRunRequest testRun = validTestRun();
        testRun.setAiProvider("a".repeat(51));

        QuickTestRequest quickTest = validQuickTest();
        quickTest.setAiProvider("a".repeat(51));

        assertInvalidAt(validator.validate(testRun), "aiProvider");
        assertInvalidAt(validator.validate(quickTest), "aiProvider");
    }

    @Test
    void rejectsNullAndInvalidTestCaseElements() {
        TestRunRequest testRunWithNullCase = validTestRun();
        testRunWithNullCase.setTestInputs(null);
        testRunWithNullCase.setTestCases(nullElementList());
        TestRunRequest testRunWithInvalidCase = validTestRun();
        testRunWithInvalidCase.setTestInputs(null);
        testRunWithInvalidCase.setTestCases(List.of(invalidCase()));

        QuickTestRequest quickTestWithNullCase = validQuickTest();
        quickTestWithNullCase.setTestInputs(null);
        quickTestWithNullCase.setTestCases(nullElementList());
        QuickTestRequest quickTestWithInvalidCase = validQuickTest();
        quickTestWithInvalidCase.setTestInputs(null);
        quickTestWithInvalidCase.setTestCases(List.of(invalidCase()));

        assertInvalidAt(validator.validate(testRunWithNullCase), "testCases[0]");
        assertInvalidAt(validator.validate(testRunWithInvalidCase), "testCases[0].variables");
        assertInvalidAt(validator.validate(quickTestWithNullCase), "testCases[0]");
        assertInvalidAt(validator.validate(quickTestWithInvalidCase), "testCases[0].variables");
    }

    @Test
    void rejectsNullLegacyInputElementsAndValues() {
        TestRunRequest testRunWithNullInput = validTestRun();
        testRunWithNullInput.setTestInputs(nullElementList());
        TestRunRequest testRunWithNullValue = validTestRun();
        testRunWithNullValue.setTestInputs(List.of(mapWithNullValue()));

        QuickTestRequest quickTestWithNullInput = validQuickTest();
        quickTestWithNullInput.setTestInputs(nullElementList());
        QuickTestRequest quickTestWithNullValue = validQuickTest();
        quickTestWithNullValue.setTestInputs(List.of(mapWithNullValue()));

        assertInvalidAt(validator.validate(testRunWithNullInput), "testInputs[0]");
        assertInvalidAt(validator.validate(testRunWithNullValue), "testInputs[0][input]");
        assertInvalidAt(validator.validate(quickTestWithNullInput), "testInputs[0]");
        assertInvalidAt(validator.validate(quickTestWithNullValue), "testInputs[0][input]");
    }

    @Test
    void rejectsNullVariableValuesButAllowsEmptyStrings() {
        assertInvalidAt(validator.validate(new EvaluationCaseRequest(
                "case", mapWithNullValue(), List.of())), "variables[input]");

        Set<ConstraintViolation<EvaluationCaseRequest>> violations = validator.validate(new EvaluationCaseRequest(
                "case", Map.of("input", ""), List.of()));

        assertTrue(violations.isEmpty(), () -> "Empty variable values should remain valid: " + violations);
    }

    @Test
    void rejectsNullAndInvalidAssertionElements() {
        EvaluationCaseRequest nullAssertion = new EvaluationCaseRequest(
                "case", Map.of("input", "value"), nullElementList());
        EvaluationCaseRequest invalidAssertion = new EvaluationCaseRequest(
                "case", Map.of("input", "value"), List.of(new AssertionRule(null, null, null)));

        assertInvalidAt(validator.validate(nullAssertion), "assertions[0]");
        assertInvalidAt(validator.validate(invalidAssertion), "assertions[0].type");
    }

    @Test
    void rejectsNullAndInvalidSuiteCaseElements() {
        TestSuiteUpsertRequest nullCase = new TestSuiteUpsertRequest("suite", null, nullElementList());
        TestSuiteUpsertRequest invalidCase = new TestSuiteUpsertRequest("suite", null, List.of(invalidCase()));

        assertInvalidAt(validator.validate(nullCase), "cases[0]");
        assertInvalidAt(validator.validate(invalidCase), "cases[0].variables");
    }

    private static TestRunRequest validTestRun() {
        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(1L);
        request.setAiProvider("openai");
        request.setModelName("gpt-test");
        request.setTestInputs(List.of(Map.of("input", "value")));
        return request;
    }

    private static QuickTestRequest validQuickTest() {
        QuickTestRequest request = new QuickTestRequest();
        request.setPromptContent("Prompt: {{input}}");
        request.setAiProvider("openai");
        request.setModelName("gpt-test");
        request.setTestInputs(List.of(Map.of("input", "value")));
        return request;
    }

    private static EvaluationCaseRequest invalidCase() {
        return new EvaluationCaseRequest("case", null, List.of());
    }

    private static Map<String, String> mapWithNullValue() {
        Map<String, String> values = new java.util.HashMap<>();
        values.put("input", null);
        return values;
    }

    private static <T> List<T> nullElementList() {
        List<T> values = new ArrayList<>();
        values.add(null);
        return values;
    }

    private static void assertInvalidAt(Set<? extends ConstraintViolation<?>> violations, String propertyPath) {
        assertFalse(violations.isEmpty(), () -> "Expected violation at " + propertyPath);
        assertTrue(violations.stream().anyMatch(violation -> {
                    String actualPath = violation.getPropertyPath().toString()
                            .replace(".<list element>", "")
                            .replace(".<map value>", "");
                    return propertyPath.equals(actualPath);
                }),
                () -> "Expected violation at " + propertyPath + ", but got " + violations);
    }
}

class PromptControllerContractTest {

    private PromptService promptService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        promptService = mock(PromptService.class);
        mockMvc = standaloneSetup(new PromptController(promptService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void returnsStructuredValidationErrors() throws Exception {
        mockMvc.perform(post("/api/prompts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\" \",\"initialContent\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/prompts"))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.initialContent").exists());
    }

    @Test
    void returnsStructuredNotFoundErrors() throws Exception {
        when(promptService.getPromptById(41L))
                .thenThrow(new ResourceNotFoundException("Prompt", 41L));

        mockMvc.perform(get("/api/prompts/41"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Prompt not found: 41"))
                .andExpect(jsonPath("$.path").value("/api/prompts/41"));
    }

    @Test
    void rejectsMalformedJsonWithoutLeakingParserDetails() throws Exception {
        mockMvc.perform(post("/api/prompts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"))
                .andExpect(jsonPath("$.message").value("Request body is not valid JSON"));
    }
}

class TestSuiteControllerContractTest {

    private TestSuiteService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(TestSuiteService.class);
        mockMvc = standaloneSetup(new TestSuiteController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void validatesNestedCasesAndRules() throws Exception {
        mockMvc.perform(post("/api/test-suites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": " ",
                                  "cases": [{
                                    "name": "case",
                                    "variables": null,
                                    "assertions": [{"type": null}]
                                  }]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors['cases[0].variables']").exists())
                .andExpect(jsonPath("$.fieldErrors['cases[0].assertions[0].type']").exists());
    }

    @Test
    void createsSuiteWithTheSharedCreatedContract() throws Exception {
        TestSuite suite = new TestSuite();
        suite.setId(9L);
        suite.setName("发布回归集");
        when(service.create(any())).thenReturn(suite);

        mockMvc.perform(post("/api/test-suites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "发布回归集",
                                  "description": "发布前执行",
                                  "cases": [{
                                    "name": "基础用例",
                                    "variables": {"topic": "发布"},
                                    "assertions": [{"type": "CONTAINS", "value": "发布"}]
                                  }]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(9))
                .andExpect(jsonPath("$.name").value("发布回归集"));
    }
}

class RegressionGateMethodValidationContractTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = standaloneSetup(new TestRunController(
                        mock(TestRunService.class), mock(RegressionGateService.class)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void returnsStructuredValidationErrorForNonPositiveCandidateRunId() throws Exception {
        mockMvc.perform(post("/api/test-runs/0/regression-gate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"baselineRunId\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.path").value("/api/test-runs/0/regression-gate"))
                .andExpect(jsonPath("$.fieldErrors.candidateRunId").exists());
    }
}

class TestRunRegressionGateContractTest {

    private RegressionGateService regressionGateService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        regressionGateService = mock(RegressionGateService.class);
        mockMvc = standaloneSetup(new TestRunController(mock(TestRunService.class), regressionGateService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void exposesRegressionGateAsAReadOnlyTestRunAction() throws Exception {
        when(regressionGateService.evaluate(eq(22L), any())).thenReturn(new RegressionGateResponse(
                11L, 22L, "PASSED", true, List.of(), List.of(), List.of()));

        mockMvc.perform(post("/api/test-runs/22/regression-gate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"baselineRunId\":11}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baselineRunId").value(11))
                .andExpect(jsonPath("$.candidateRunId").value(22))
                .andExpect(jsonPath("$.verdict").value("PASSED"))
                .andExpect(jsonPath("$.passed").value(true));
    }

    @Test
    void rejectsMissingBaselineAndOutOfRangeGates() throws Exception {
        mockMvc.perform(post("/api/test-runs/22/regression-gate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "gates": {
                                    "minCasePassRate": 1.01,
                                    "maxQualityScoreDrop": -0.01,
                                    "maxCostIncreasePercent": -1,
                                    "maxLatencyIncreasePercent": -1
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.baselineRunId").exists())
                .andExpect(jsonPath("$.fieldErrors['gates.minCasePassRate']").exists())
                .andExpect(jsonPath("$.fieldErrors['gates.maxQualityScoreDrop']").exists())
                .andExpect(jsonPath("$.fieldErrors['gates.maxCostIncreasePercent']").exists())
                .andExpect(jsonPath("$.fieldErrors['gates.maxLatencyIncreasePercent']").exists());
    }
}

class RegressionGatePositiveValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void rejectsNonPositiveBaselineRunId() {
        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(0L);

        Set<ConstraintViolation<RegressionGateRequest>> violations = validator.validate(request);

        assertThat(violations).extracting(violation -> violation.getPropertyPath().toString())
                .contains("baselineRunId");
    }

    @Test
    void rejectsNonPositiveCandidateRunId() throws Exception {
        TestRunController controller = new TestRunController(
                mock(TestRunService.class), mock(RegressionGateService.class));
        RegressionGateRequest request = new RegressionGateRequest();
        request.setBaselineRunId(1L);
        Method method = TestRunController.class.getMethod(
                "evaluateRegressionGate", Long.class, RegressionGateRequest.class);

        Set<ConstraintViolation<TestRunController>> violations = validator.forExecutables()
                .validateParameters(controller, method, new Object[]{0L, request});

        assertThat(violations).extracting(violation -> violation.getPropertyPath().toString())
                .anyMatch(path -> path.endsWith("candidateRunId"));
    }
}
