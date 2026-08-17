package com.promptframework.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.promptframework.model.dto.EvaluationCaseRequest;

import java.util.List;

public class EvaluationCaseListTypeHandler extends AbstractJsonTypeHandler<List<EvaluationCaseRequest>> {

    public EvaluationCaseListTypeHandler() {
        super(new TypeReference<>() {
        });
    }
}
