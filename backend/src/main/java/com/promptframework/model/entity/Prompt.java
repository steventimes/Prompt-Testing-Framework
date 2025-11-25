package com.promptframework.model.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Prompt {

    private Long id;
    private String name;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
