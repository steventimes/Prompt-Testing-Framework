package com.promptframework.model.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class QuickTestRequest {

    @NotBlank(message = "Prompt content is required")
    @Size(max = 100000, message = "Prompt content is too large")
    private String promptContent;

    @NotBlank(message = "AI provider is required")
    @Size(max = 50, message = "AI provider is too long")
    private String aiProvider;

    @NotBlank(message = "Model name is required")
    @Size(max = 100, message = "Model name is too long")
    private String modelName;

    // 旧版输入：每个变量 Map 及其变量值均不可为 null。
    @Size(max = 100, message = "At most 100 test inputs are allowed")
    private List<@NotNull Map<String, @NotNull String>> testInputs;

    // 每个测试用例必须存在，并递归校验其变量和断言。
    @Valid
    @Size(max = 100, message = "At most 100 test cases are allowed")
    private List<@NotNull @Valid EvaluationCaseRequest> testCases;

    @JsonIgnore
    @AssertTrue(message = "Exactly one of testCases or testInputs is required")
    public boolean isTestSourceValid() {
        int sourceCount = testCases == null || testCases.isEmpty() ? 0 : 1;
        sourceCount += testInputs == null || testInputs.isEmpty() ? 0 : 1;
        return sourceCount == 1;
    }
}
