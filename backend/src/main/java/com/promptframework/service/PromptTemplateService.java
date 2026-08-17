package com.promptframework.service;

import com.promptframework.model.dto.PromptTemplateAnalysis;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PromptTemplateService {

    private static final String VARIABLE_NAME = "[A-Za-z][A-Za-z0-9_.-]*";
    private static final Pattern PLACEHOLDER = Pattern.compile(
            "\\{\\{\\s*(" + VARIABLE_NAME + ")\\s*}}|(?<!\\{)\\{\\s*(" + VARIABLE_NAME + ")\\s*}(?!})"
    );

    /**
     * 一次完成变量发现、缺失检查和安全渲染，确保所有执行入口使用完全相同的模板语义。
     */
    public PromptTemplateAnalysis analyze(String content, Map<String, String> values) {
        Objects.requireNonNull(content, "Prompt content must not be null");
        Map<String, String> safeValues = values == null ? Map.of() : values;
        Set<String> variables = new LinkedHashSet<>();
        Set<String> missingVariables = new LinkedHashSet<>();

        Matcher matcher = PLACEHOLDER.matcher(content);
        StringBuffer rendered = new StringBuffer();
        while (matcher.find()) {
            String variable = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            variables.add(variable);

            if (safeValues.containsKey(variable) && safeValues.get(variable) != null) {
                // quoteReplacement 防止用户输入中的 $ 和反斜杠被正则替换器二次解释。
                matcher.appendReplacement(rendered, Matcher.quoteReplacement(safeValues.get(variable)));
            } else {
                missingVariables.add(variable);
                matcher.appendReplacement(rendered, Matcher.quoteReplacement(matcher.group()));
            }
        }
        matcher.appendTail(rendered);

        List<String> variableList = List.copyOf(variables);
        List<String> missingList = List.copyOf(new ArrayList<>(missingVariables));
        return new PromptTemplateAnalysis(variableList, missingList, rendered.toString(), missingList.isEmpty());
    }
}
