package com.promptframework.model.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PromptVersion {

    private Long id;
    private Long promptId;
    private Integer versionNumber;
    private String content;
    private LocalDateTime createdAt;
}
