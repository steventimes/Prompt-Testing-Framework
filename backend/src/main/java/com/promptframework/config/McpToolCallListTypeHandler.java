package com.promptframework.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.promptframework.model.dto.McpToolCall;

import java.util.List;

public class McpToolCallListTypeHandler extends AbstractJsonTypeHandler<List<McpToolCall>> {

    public McpToolCallListTypeHandler() {
        super(new TypeReference<>() {
        });
    }
}
