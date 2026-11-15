package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.JoinClassRequest;
import com.exammatrix.backend.dto.response.StudentAssignmentResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.service.StudentClassService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/student")
@RequiredArgsConstructor
public class StudentClassController {
    private final StudentClassService studentClassService;

    @GetMapping("/teachers")
    public ResponseEntity<List<UserResponse>> getTeachers() {
        return ResponseEntity.ok(studentClassService.getAvailableTeachers());
    }

    @PostMapping({"/classes/join", "/teacher-requests"})
    public ResponseEntity<StudentAssignmentResponse> joinClass(@Valid @RequestBody JoinClassRequest request) {
        return ResponseEntity.ok(studentClassService.joinClass(request));
    }

    @GetMapping({"/classes/current", "/teacher-requests/current"})
    public ResponseEntity<StudentAssignmentResponse> getCurrentAssignment() {
        StudentAssignmentResponse response = studentClassService.getCurrentAssignment();
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }
}
