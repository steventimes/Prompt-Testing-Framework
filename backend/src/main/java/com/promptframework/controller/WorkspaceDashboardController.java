package com.promptframework.controller;

import com.promptframework.model.dto.WorkspaceSummaryResponse;
import com.promptframework.service.WorkspaceDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspace")
@RequiredArgsConstructor
public class WorkspaceDashboardController {

    private final WorkspaceDashboardService workspaceDashboardService;

    @GetMapping("/summary")
    public ResponseEntity<WorkspaceSummaryResponse> getWorkspaceSummary() {
        return ResponseEntity.ok(workspaceDashboardService.getWorkspaceSummary());
    }
}
