package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.response.DashboardResponse;
import com.exammatrix.backend.dto.response.DashboardAnalyticsResponse;
import com.exammatrix.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardResponse> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }

    @GetMapping("/analytics")
    public ResponseEntity<DashboardAnalyticsResponse> getAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(required = false) Integer subjectId,
            @RequestParam(required = false) Integer days
    ) {
        return ResponseEntity.ok(dashboardService.getAnalytics(weekStart, subjectId, days));
    }
}
