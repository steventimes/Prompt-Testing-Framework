package com.promptframework.config;

import com.fasterxml.jackson.core.type.TypeReference;

import java.util.List;

public class JsonStringListTypeHandler extends AbstractJsonTypeHandler<List<String>> {

    public JsonStringListTypeHandler() {
        super(new TypeReference<>() {
        });
    }
}
