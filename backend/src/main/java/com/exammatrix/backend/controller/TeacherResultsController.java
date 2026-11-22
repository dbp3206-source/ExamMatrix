package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.TeacherResultRowResponse;
import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.service.TeacherResultsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/teacher/results")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'CONTENT_ADMIN')")
@RequiredArgsConstructor
public class TeacherResultsController {
    private final TeacherResultsService teacherResultsService;

    @GetMapping
    public ResponseEntity<PageResponse<TeacherResultRowResponse>> getTeacherResults(
            @RequestParam(required = false) ExamType examType,
            @RequestParam(required = false) AttemptStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "time") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return ResponseEntity.ok(
                teacherResultsService.getTeacherResults(examType, status, search, sortBy, sortDir, page, size)
        );
    }
}
