package com.promptframework.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.QuickTestResponse;
import com.promptframework.service.QuickTestService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/quick-test")
@RequiredArgsConstructor
@Slf4j
public class QuickTestController {

    private final QuickTestService quickTestService;

    @PostMapping
    public ResponseEntity<QuickTestResponse> quickTest(
            @Valid @RequestBody QuickTestRequest request) {

        log.info("Running quick test with provider: {}, model: {}",
                request.getAiProvider(), request.getModelName());
        return ResponseEntity.ok(quickTestService.execute(request));
    }
}
