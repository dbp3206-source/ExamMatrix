package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.response.AdminResultRowResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.service.AdminResultsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/results")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminResultsController {
    private final AdminResultsService adminResultsService;

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> listUsers(
            @RequestParam(defaultValue = "TEACHER") String role,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(adminResultsService.listUsersByRole(role, search));
    }

    @GetMapping("/teacher/{teacherId}/essays")
    public ResponseEntity<PageResponse<AdminResultRowResponse>> getTeacherGradedEssays(
            @PathVariable UUID teacherId,
            @RequestParam(defaultValue = "gradedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(adminResultsService.getTeacherGradedEssays(teacherId, sortBy, sortDir, page, size));
    }

    @GetMapping("/teacher/{teacherId}/objectives")
    public ResponseEntity<PageResponse<AdminResultRowResponse>> getTeacherObjectiveResults(
            @PathVariable UUID teacherId,
            @RequestParam(defaultValue = "BOTH") String scope,
            @RequestParam(defaultValue = "gradedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(adminResultsService.getTeacherObjectiveResults(teacherId, scope, sortBy, sortDir, page, size));
    }

    @GetMapping("/student/{studentId}/attempts")
    public ResponseEntity<PageResponse<AdminResultRowResponse>> getStudentResults(
            @PathVariable UUID studentId,
            @RequestParam(defaultValue = "gradedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(adminResultsService.getStudentResults(studentId, sortBy, sortDir, page, size));
    }
}
