package com.promptframework.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.postgresql.util.PGobject;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

abstract class AbstractJsonTypeHandler<T> extends BaseTypeHandler<T> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private final TypeReference<T> typeReference;

    protected AbstractJsonTypeHandler(TypeReference<T> typeReference) {
        this.typeReference = typeReference;
    }

    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, T parameter, JdbcType jdbcType)
            throws SQLException {
        PGobject json = new PGobject();
        json.setType("jsonb");
        try {
            json.setValue(OBJECT_MAPPER.writeValueAsString(parameter));
        } catch (JsonProcessingException exception) {
            throw new SQLException("无法序列化 JSONB 参数", exception);
        }
        statement.setObject(index, json);
    }

    @Override
    public T getNullableResult(ResultSet resultSet, String columnName) throws SQLException {
        return deserialize(resultSet.getString(columnName));
    }

    @Override
    public T getNullableResult(ResultSet resultSet, int columnIndex) throws SQLException {
        return deserialize(resultSet.getString(columnIndex));
    }

    @Override
    public T getNullableResult(CallableStatement statement, int columnIndex) throws SQLException {
        return deserialize(statement.getString(columnIndex));
    }

    private T deserialize(String value) throws SQLException {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            // 类型信息由具体 handler 固定，避免把 JSONB 读取成不安全的原始 Map/List。
            return OBJECT_MAPPER.readValue(value, typeReference);
        } catch (JsonProcessingException exception) {
            throw new SQLException("无法反序列化 JSONB 字段", exception);
        }
    }
}
