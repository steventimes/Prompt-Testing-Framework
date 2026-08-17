package com.promptframework.controller;

import com.promptframework.model.dto.PromptCreateRequest;
import com.promptframework.model.dto.PromptResponse;
import com.promptframework.model.dto.PromptUpdateRequest;
import com.promptframework.model.dto.PromptVersionCreateRequest;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.service.PromptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService promptService;

    @PostMapping
    public ResponseEntity<PromptResponse> createPrompt(
            @Valid @RequestBody PromptCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(promptService.createPrompt(request));
    }

    @GetMapping
    public ResponseEntity<List<PromptResponse>> getAllPrompts() {
        return ResponseEntity.ok(promptService.getAllPrompts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PromptResponse> getPrompt(@PathVariable Long id) {
        return ResponseEntity.ok(promptService.getPromptById(id));
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<PromptVersion> createVersion(
            @PathVariable Long id,
            @Valid @RequestBody PromptVersionCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promptService.createNewVersion(id, request.getContent()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PromptResponse> updatePrompt(
            @PathVariable Long id,
            @Valid @RequestBody PromptUpdateRequest request) {
        return ResponseEntity.ok(promptService.updatePrompt(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePrompt(@PathVariable Long id) {
        promptService.deletePrompt(id);
    }
}
