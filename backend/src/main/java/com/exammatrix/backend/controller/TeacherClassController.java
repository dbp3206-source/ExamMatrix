package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.ReviewStudentAssignmentRequest;
import com.exammatrix.backend.dto.request.UpdateTeacherClassRequest;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.TeacherClassResponse;
import com.exammatrix.backend.entity.enums.StudentAssignmentStatus;
import com.exammatrix.backend.service.TeacherClassService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/teacher")
@RequiredArgsConstructor
public class TeacherClassController {
    private final TeacherClassService teacherClassService;

    @GetMapping("/classes")
    public ResponseEntity<TeacherClassResponse> getTeacherClass() {
        return ResponseEntity.ok(teacherClassService.getOrCreateCurrentTeacherClass());
    }

    @PatchMapping("/classes")
    public ResponseEntity<TeacherClassResponse> updateTeacherClass(
            @Valid @RequestBody UpdateTeacherClassRequest request
    ) {
        return ResponseEntity.ok(teacherClassService.updateCurrentTeacherClass(request));
    }

    @GetMapping({"/classes/students", "/student-requests"})
    public ResponseEntity<PageResponse<StudentAssignmentResponse>> getTeacherStudents(
            @RequestParam(required = false) StudentAssignmentStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return ResponseEntity.ok(teacherClassService.getTeacherStudents(status, pageable));
    }

    @PatchMapping({"/classes/students/{id}", "/student-requests/{id}"})
    public ResponseEntity<StudentAssignmentResponse> reviewStudent(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewStudentAssignmentRequest request
    ) {
        return ResponseEntity.ok(teacherClassService.reviewStudentAssignment(id, request));
    }
}
