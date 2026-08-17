package com.promptframework.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.promptframework.config.EvaluationCaseListTypeHandler;
import com.promptframework.model.dto.EvaluationCaseRequest;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "test_suites", autoResultMap = true)
public class TestSuite {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    @TableField(typeHandler = EvaluationCaseListTypeHandler.class)
    private List<EvaluationCaseRequest> cases;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
