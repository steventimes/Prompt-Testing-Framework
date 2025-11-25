package com.promptframework.model.entity;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class PromptVersion {

    private Long id;
    private Long promptId;
    private Integer versionNumber;
    private String content;  // prompt text
    private Map<String, String> variables; //for filled in
    private LocalDateTime createdAt;
}
