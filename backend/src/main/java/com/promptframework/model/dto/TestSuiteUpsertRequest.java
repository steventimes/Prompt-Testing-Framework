package com.promptframework.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TestSuiteUpsertRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 2000) String description,
        // 套件中的用例必须存在，并递归校验其变量和断言。
        @NotEmpty @Size(max = 100) List<@NotNull @Valid EvaluationCaseRequest> cases
) {
}
