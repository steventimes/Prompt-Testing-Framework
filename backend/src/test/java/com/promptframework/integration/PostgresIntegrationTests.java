package com.promptframework.integration;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.promptframework.mapper.TestSuiteMapper;
import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.AssertionType;
import com.promptframework.model.dto.EvaluationCaseRequest;
import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.entity.TestResult;
import com.promptframework.model.entity.TestSuite;
import com.promptframework.service.TestRunLifecycleService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class MybatisPlusPostgresIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("ai.mock-mode", () -> true);
    }

    @Autowired
    private TestSuiteMapper testSuiteMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayMybatisPlusPaginationAndJsonbWorkTogether() {
        TestSuite suite = new TestSuite();
        suite.setName("PostgreSQL 回归集");
        suite.setDescription("真实 JSONB 往返");
        suite.setCases(List.of(new EvaluationCaseRequest(
                "JSON 输出",
                Map.of("topic", "迁移"),
                List.of(new AssertionRule(AssertionType.JSON_VALID, null, null))
        )));
        suite.setCreatedAt(LocalDateTime.now());
        suite.setUpdatedAt(LocalDateTime.now());

        assertThat(testSuiteMapper.insert(suite)).isEqualTo(1);
        assertThat(suite.getId()).isNotNull();

        Page<TestSuite> page = testSuiteMapper.selectPage(
                Page.of(1, 5),
                Wrappers.<TestSuite>lambdaQuery().orderByDesc(TestSuite::getUpdatedAt)
        );
        assertThat(page.getRecords()).extracting(TestSuite::getName).contains("PostgreSQL 回归集");

        TestSuite reloaded = testSuiteMapper.selectById(suite.getId());
        assertThat(reloaded.getCases()).singleElement().satisfies(testCase -> {
            assertThat(testCase.name()).isEqualTo("JSON 输出");
            assertThat(testCase.assertions()).singleElement()
                    .extracting(AssertionRule::type)
                    .isEqualTo(AssertionType.JSON_VALID);
        });

        Integer migrationCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success",
                Integer.class
        );
        assertThat(migrationCount).isPositive();
    }
}

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class TestRunLifecyclePostgresIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("ai.mock-mode", () -> true);
    }

    @Autowired
    private TestRunLifecycleService lifecycle;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void persistsAndReloadsTheDatasetFingerprint() {
        Long promptVersionId = jdbcTemplate.queryForObject(
                "SELECT id FROM prompt_versions ORDER BY id LIMIT 1", Long.class);
        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(promptVersionId);
        request.setAiProvider("openai");
        request.setModelName("gpt-4o-mini");
        String fingerprint = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

        var started = lifecycle.start(request, fingerprint);

        String stored = jdbcTemplate.queryForObject(
                "SELECT dataset_fingerprint FROM test_runs WHERE id = ?",
                String.class,
                started.getId()
        );
        assertThat(stored).isEqualTo(fingerprint);
        assertThat(lifecycle.get(started.getId()).getDatasetFingerprint()).isEqualTo(fingerprint);
    }

    @Test
    void rollsBackEveryResultWhenCompletingABatchFailsHalfway() {
        Long promptVersionId = jdbcTemplate.queryForObject(
                "SELECT id FROM prompt_versions ORDER BY id LIMIT 1", Long.class);
        TestRunRequest request = new TestRunRequest();
        request.setPromptVersionId(promptVersionId);
        request.setAiProvider("openai");
        request.setModelName("gpt-4o-mini");
        var run = lifecycle.start(request);

        TestResult valid = result("COMPLETED", "第一条");
        TestResult invalid = result(null, "第二条缺少必填状态");

        assertThatThrownBy(() -> lifecycle.complete(run.getId(), List.of(valid, invalid), "PARTIAL"))
                .isInstanceOf(RuntimeException.class);

        Integer persistedResults = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM test_results WHERE test_run_id = ?",
                Integer.class,
                run.getId()
        );
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM test_runs WHERE id = ?",
                String.class,
                run.getId()
        );
        assertThat(persistedResults).isZero();
        assertThat(status).isEqualTo("RUNNING");
    }

    private TestResult result(String status, String response) {
        TestResult result = new TestResult();
        result.setStatus(status);
        result.setInputVariables(Map.of("topic", "事务"));
        result.setAiResponse(response);
        result.setResponseTimeMs(10);
        result.setTokenCount(2);
        result.setAssertionResults(List.of());
        return result;
    }
}
