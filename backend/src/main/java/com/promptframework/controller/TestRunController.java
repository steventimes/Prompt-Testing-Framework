package com.promptframework.controller;

import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.model.dto.QuickTestRequest;
import com.promptframework.model.dto.QuickTestResult;
import com.promptframework.model.dto.QuickTestResponse;
import com.promptframework.service.AIExecutionService;
import com.promptframework.service.TestRunService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test-runs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class TestRunController {

    private final TestRunService testRunService;

    @PostMapping
    public ResponseEntity<TestRunResponse> executeTest(
            @Valid @RequestBody TestRunRequest request) {
        return ResponseEntity.ok(testRunService.executeTest(request));
    }

    @GetMapping("{id}")
    public ResponseEntity<TestRunResponse> getTestRunById(@PathVariable Long id) {
        return ResponseEntity.ok(testRunService.getTestRun(id));
    }
}
