package com.promptframework.model.entity;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class TestRun {

    private Long id;
    private Long promptVersionId;
    private String aiProvider;
    private String modelName;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String status;
}
