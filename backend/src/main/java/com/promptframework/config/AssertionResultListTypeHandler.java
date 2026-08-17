package com.promptframework.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.promptframework.model.dto.AssertionResult;

import java.util.List;

public class AssertionResultListTypeHandler extends AbstractJsonTypeHandler<List<AssertionResult>> {

    public AssertionResultListTypeHandler() {
        super(new TypeReference<>() {
        });
    }
}
