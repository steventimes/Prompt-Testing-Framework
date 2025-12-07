package com.promptframework.controller;

import com.promptframework.model.dto.PromptCreateRequest;
import com.promptframework.model.dto.PromptResponse;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import com.promptframework.service.PromptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PromptController {

    private final PromptService promptService;

    @PostMapping
    public ResponseEntity<PromptResponse> createPrompt(
            @Valid @RequestBody PromptCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(promptService.createPrompt(request));
    }

    @GetMapping
    public ResponseEntity<List<Prompt>> getAllPrompts() {
        return ResponseEntity.ok(promptService.getAllPrompts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PromptResponse> getPrompt(@PathVariable Long id) {
        return ResponseEntity.ok(promptService.getPromptById(id));
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<PromptVersion> createVersion(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String content = body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(promptService.createNewVersion(id, content));
    }

    @PostMapping("/{id}/versions/named")
    public ResponseEntity<PromptVersion> createNamedVersion(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String content = body.get("content");
        String versionName = body.get("versionName"); // used later

        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        PromptVersion version = promptService.createNewVersion(id, content);
        return ResponseEntity.status(HttpStatus.CREATED).body(version);
    }
}
