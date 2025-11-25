package com.promptframework.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import com.promptframework.model.entity.PromptVersion;

@Data
public class PromptResponse {

    private Long id;
    private String name;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<PromptVersion> versions;
}
