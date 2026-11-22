package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.CreateStudentNameWarningRequest;
import com.exammatrix.backend.dto.request.CreateUserRequest;
import com.exammatrix.backend.dto.request.UpdateUserRequest;
import com.exammatrix.backend.dto.request.UpdateUserStatusRequest;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.StudentNameWarningResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.service.StudentNameWarningService;
import com.exammatrix.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@PreAuthorize("hasAnyRole('ADMIN', 'USER_ADMIN')")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final StudentNameWarningService studentNameWarningService;

    @GetMapping
    public ResponseEntity<PageResponse<UserResponse>>
    getAllUsers(
        @RequestParam(required = false)
        String search,

        @RequestParam(required = false)
        String role,

        @RequestParam(required = false)
        UserStatus status,

        @RequestParam(defaultValue = "0")
        Integer page,

        @RequestParam(defaultValue = "10")
        Integer size
    ) {
        PageResponse<UserResponse> response = userService.getAllUsers(search, role, status, page, size);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable("id") UUID id) {
        UserResponse response = userService.getUserById(id);

        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(
        @PathVariable("id") UUID id,
        @Valid @RequestBody UpdateUserRequest request) {
            UserResponse response = userService.updateUserById(id, request);

            return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<UserResponse> updateStatus(
        @PathVariable("id") UUID id,

        @Valid
        @RequestBody
        UpdateUserStatusRequest request) {
            UserResponse response = userService.updateUserStatus(id, request);

            return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/name-warnings")
    public ResponseEntity<List<StudentNameWarningResponse>> getStudentNameWarnings(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(studentNameWarningService.getWarningsForStudent(id));
    }

    @PostMapping("/{id}/name-warnings")
    public ResponseEntity<StudentNameWarningResponse> sendStudentNameWarning(
        @PathVariable("id") UUID id,
        @Valid @RequestBody CreateStudentNameWarningRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(studentNameWarningService.sendWarning(id, request));
    }
}
