package com.promptframework.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.promptframework.model.dto.TestRunRequest;
import com.promptframework.model.dto.TestRunResponse;
import com.promptframework.service.TestRunService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/test-runs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class TestRunController {

    private final TestRunService testRunService;

    @PostMapping
    public ResponseEntity<TestRunResponse> executeTest(
            @Valid @RequestBody TestRunRequest request,
            @RequestHeader(value = "X-API-KEY", required = false) String apiKey) {

        return ResponseEntity.ok(testRunService.executeTest(request, apiKey));
    }

    @GetMapping("{id}")
    public ResponseEntity<TestRunResponse> getTestRunById(@PathVariable Long id) {
        return ResponseEntity.ok(testRunService.getTestRun(id));
    }

    @GetMapping("/version/{versionId}")
    public ResponseEntity<List<TestRunResponse>> getTestRunsByVersion(@PathVariable Long versionId) {
        List<TestRunResponse> testRuns = testRunService.getTestRunsByVersion(versionId);
        return ResponseEntity.ok(testRuns);
    }
}
