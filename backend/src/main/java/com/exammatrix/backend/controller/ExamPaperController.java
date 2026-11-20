package com.exammatrix.backend.controller;

import com.exammatrix.backend.dto.request.UpdateExamPaperAccessRequest;
import com.exammatrix.backend.dto.response.ExamPaperDetailResponse;
import com.exammatrix.backend.dto.response.ExamPaperSummaryResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;
import com.exammatrix.backend.service.ExamPaperService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/exam-papers")
@RequiredArgsConstructor
public class ExamPaperController {
    private final ExamPaperService examPaperService;

    @GetMapping
    public ResponseEntity<PageResponse<ExamPaperDetailResponse>> getAllExamPapers(
            @RequestParam(required = false)
            UUID matrixId,

            @RequestParam(defaultValue = "0")
            Integer page,

            @RequestParam(defaultValue = "10")
            Integer size
    ) {
        return ResponseEntity.ok(examPaperService.getAllExamPapers(
                    matrixId,
                    page,
                    size
            )
        );
    }

    @GetMapping("/summary")
    public ResponseEntity<PageResponse<ExamPaperSummaryResponse>> getExamPaperSummaries(
            @RequestParam(required = false) UUID matrixId,
            @RequestParam(required = false) Integer subjectId,
            @RequestParam(required = false) ExamType examType,
            @RequestParam(required = false) ExamAccessType accessType,
            @RequestParam(required = false) Boolean isPublished,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size
    ) {
        return ResponseEntity.ok(examPaperService.getExamPaperSummaries(
                matrixId, subjectId, examType, accessType, isPublished, search, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExamPaperDetailResponse> getExamPaperById(@PathVariable UUID id) {
        return ResponseEntity.ok(examPaperService.getExamPaperById(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ExamPaperDetailResponse> updateExamPaperAccess(
            @PathVariable UUID id,
            @RequestBody UpdateExamPaperAccessRequest request
    ) {
        return ResponseEntity.ok(examPaperService.updateExamPaperAccess(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteExamPaper(@PathVariable UUID id) {
        examPaperService.deleteExamPaper(id);

        return ResponseEntity.noContent().build();
    }
}
