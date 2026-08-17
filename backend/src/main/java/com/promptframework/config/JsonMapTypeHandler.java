package com.promptframework.config;

import com.fasterxml.jackson.core.type.TypeReference;

import java.util.Map;

public class JsonMapTypeHandler extends AbstractJsonTypeHandler<Map<String, String>> {

    public JsonMapTypeHandler() {
        super(new TypeReference<>() {
        });
    }
}
