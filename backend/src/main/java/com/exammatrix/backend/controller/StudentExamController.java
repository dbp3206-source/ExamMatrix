package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.SaveAttemptAnswerRequest;
import com.exammatrix.backend.dto.response.*;
import com.exammatrix.backend.service.StudentExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Duration;
import java.util.UUID;
import com.exammatrix.backend.service.RateLimiterService;

@RestController
@RequestMapping("/student")
@RequiredArgsConstructor
public class StudentExamController {
    private final StudentExamService studentExamService;
    private final RateLimiterService rateLimiterService;

    @GetMapping("/exams")
    public ResponseEntity<PageResponse<StudentExamSummaryResponse>> getAccessibleExams(
            @RequestParam(required = false) Integer subjectId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "publishedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return ResponseEntity.ok(studentExamService.getAccessibleExams(subjectId, search, sortBy, sortDir, pageable));
    }

    @GetMapping("/exams/subjects")
    public ResponseEntity<java.util.List<StudentSubjectExamCountResponse>> getAccessibleExamSubjects() {
        return ResponseEntity.ok(studentExamService.getAccessibleExamSubjectCounts());
    }

    @GetMapping("/exams/{paperId}")
    public ResponseEntity<StudentExamDetailResponse> getExamDetail(@PathVariable UUID paperId) {
        return ResponseEntity.ok(studentExamService.getExamDetail(paperId));
    }

    @PostMapping("/exams/{paperId}/attempts")
    public ResponseEntity<StartAttemptResponse> startAttempt(
            @PathVariable UUID paperId,
            @RequestParam(defaultValue = "false") boolean forceNew,
            Principal principal
    ) {
        if (!rateLimiterService.tryAcquire("rl:exam-start:" + principal.getName(), 12, Duration.ofMinutes(1))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60").build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(studentExamService.startAttempt(paperId, forceNew));
    }

    @PatchMapping("/attempts/{attemptId}/answers")
    public ResponseEntity<Void> saveAnswer(
            @PathVariable UUID attemptId,
            @Valid @RequestBody SaveAttemptAnswerRequest request
    ) {
        studentExamService.saveAnswer(attemptId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public ResponseEntity<StudentAttemptResultResponse> submitAttempt(@PathVariable UUID attemptId) {
        return ResponseEntity.ok(studentExamService.submitAttempt(attemptId));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<StudentAttemptResultResponse> getAttemptResult(@PathVariable UUID attemptId) {
        return ResponseEntity.ok(studentExamService.getAttemptResult(attemptId));
    }
}
