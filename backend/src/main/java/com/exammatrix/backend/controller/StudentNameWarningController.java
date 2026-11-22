package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.response.StudentNameWarningResponse;
import com.exammatrix.backend.service.StudentNameWarningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/student/name-warnings")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentNameWarningController {
    private final StudentNameWarningService studentNameWarningService;

    @GetMapping
    public ResponseEntity<List<StudentNameWarningResponse>> getMyWarnings() {
        return ResponseEntity.ok(studentNameWarningService.getMyWarnings());
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<StudentNameWarningResponse> markAsRead(@PathVariable UUID id) {
        return ResponseEntity.ok(studentNameWarningService.markMyWarningAsRead(id));
    }
}
