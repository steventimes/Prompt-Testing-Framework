package com.promptframework.controller;

import com.promptframework.model.dto.TestSuiteUpsertRequest;
import com.promptframework.model.entity.TestSuite;
import com.promptframework.service.TestSuiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/test-suites")
@RequiredArgsConstructor
public class TestSuiteController {

    private final TestSuiteService testSuiteService;

    @PostMapping
    public ResponseEntity<TestSuite> create(@Valid @RequestBody TestSuiteUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(testSuiteService.create(request));
    }

    @GetMapping
    public List<TestSuite> list() {
        return testSuiteService.list();
    }

    @GetMapping("/{id}")
    public TestSuite get(@PathVariable Long id) {
        return testSuiteService.get(id);
    }

    @PutMapping("/{id}")
    public TestSuite update(@PathVariable Long id,
            @Valid @RequestBody TestSuiteUpsertRequest request) {
        return testSuiteService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        testSuiteService.delete(id);
    }
}
