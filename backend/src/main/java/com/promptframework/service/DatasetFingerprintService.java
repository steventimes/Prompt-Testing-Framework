package com.promptframework.service;

import com.promptframework.model.dto.AssertionRule;
import com.promptframework.model.dto.EvaluationCaseRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * 为一次实际执行的数据集生成稳定指纹，用于确认两个运行是否使用了同一批输入与断言。
 */
@Service
public class DatasetFingerprintService {

    private static final Comparator<Map.Entry<String, String>> VARIABLE_ORDER =
            Comparator.comparing(Map.Entry<String, String>::getKey,
                    Comparator.nullsFirst(Comparator.naturalOrder()));

    public String fingerprintCases(List<EvaluationCaseRequest> cases) {
        CanonicalWriter writer = new CanonicalWriter();
        writer.literal("dataset:v1;");
        writeCases(writer, cases);
        return sha256(writer.bytes());
    }

    public String fingerprintLegacyInputs(List<Map<String, String>> testInputs) {
        if (testInputs == null) {
            return fingerprintCases(null);
        }
        List<EvaluationCaseRequest> cases = new ArrayList<>(testInputs.size());
        for (Map<String, String> input : testInputs) {
            // 旧版输入没有名称和断言，统一投影成完整用例结构后再计算。
            cases.add(new EvaluationCaseRequest(null, input, List.of()));
        }
        return fingerprintCases(cases);
    }

    private void writeCases(CanonicalWriter writer, List<EvaluationCaseRequest> cases) {
        if (cases == null) {
            writer.literal("cases:null;");
            return;
        }
        writer.literal("cases:").literal(Integer.toString(cases.size())).literal(";");
        for (int index = 0; index < cases.size(); index++) {
            writer.literal("case:").literal(Integer.toString(index)).literal(";");
            writeCase(writer, cases.get(index));
        }
    }

    private void writeCase(CanonicalWriter writer, EvaluationCaseRequest testCase) {
        if (testCase == null) {
            writer.literal("case:null;");
            return;
        }
        writer.nullable("name", testCase.name());
        writeVariables(writer, testCase.variables());
        writeAssertions(writer, testCase.assertions());
    }

    private void writeVariables(CanonicalWriter writer, Map<String, String> variables) {
        if (variables == null) {
            writer.literal("variables:null;");
            return;
        }
        writer.literal("variables:").literal(Integer.toString(variables.size())).literal(";");
        variables.entrySet().stream()
                .sorted(VARIABLE_ORDER)
                .forEach(entry -> {
                    writer.nullable("key", entry.getKey());
                    writer.nullable("value", entry.getValue());
                });
    }

    private void writeAssertions(CanonicalWriter writer, List<AssertionRule> assertions) {
        if (assertions == null) {
            writer.literal("assertions:null;");
            return;
        }
        writer.literal("assertions:").literal(Integer.toString(assertions.size())).literal(";");
        for (int index = 0; index < assertions.size(); index++) {
            writer.literal("assertion:").literal(Integer.toString(index)).literal(";");
            AssertionRule assertion = assertions.get(index);
            if (assertion == null) {
                writer.literal("assertion:null;");
                continue;
            }
            writer.nullable("type", assertion.type() == null ? null : assertion.type().name());
            writer.nullable("value", assertion.value());
            writer.nullable("threshold", normalizeThreshold(assertion.threshold()));
        }
    }

    private String normalizeThreshold(Double threshold) {
        if (threshold == null) {
            return null;
        }
        if (!Double.isFinite(threshold)) {
            // 脏的历史数据也必须可比较，不能让指纹计算抢先中断运行生命周期。
            return Double.toString(threshold);
        }
        return BigDecimal.valueOf(threshold).stripTrailingZeros().toPlainString();
    }

    private String sha256(byte[] canonicalBytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonicalBytes));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("JVM does not provide SHA-256", unavailable);
        }
    }

    private static final class CanonicalWriter {

        private final StringBuilder value = new StringBuilder();

        private CanonicalWriter literal(String text) {
            value.append(text);
            return this;
        }

        private void nullable(String field, String text) {
            value.append(field).append(':');
            if (text == null) {
                value.append("null;");
                return;
            }
            int byteLength = text.getBytes(StandardCharsets.UTF_8).length;
            value.append(byteLength).append(':').append(text).append(';');
        }

        private byte[] bytes() {
            return value.toString().getBytes(StandardCharsets.UTF_8);
        }
    }
}
