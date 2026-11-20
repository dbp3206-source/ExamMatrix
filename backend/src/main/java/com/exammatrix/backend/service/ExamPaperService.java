package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.GenerateExamPapersRequest;
import com.exammatrix.backend.dto.request.UpdateExamPaperAccessRequest;
import com.exammatrix.backend.dto.response.ExamPaperDetailResponse;
import com.exammatrix.backend.dto.response.ExamPaperSummaryResponse;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.entity.enums.ExamAccessType;
import com.exammatrix.backend.entity.enums.ExamType;

import java.util.List;
import java.util.UUID;

public interface ExamPaperService {

    PageResponse<ExamPaperDetailResponse> getAllExamPapers(
            UUID matrixId,
            Integer page,
            Integer size
    );

    ExamPaperDetailResponse getExamPaperById(UUID id);

    PageResponse<ExamPaperSummaryResponse> getExamPaperSummaries(
            UUID matrixId, Integer subjectId, ExamType examType, ExamAccessType accessType,
            Boolean isPublished, String search, Integer page, Integer size);

    List<ExamPaperDetailResponse> generateExamPapers(UUID matrixId, GenerateExamPapersRequest request);

    ExamPaperDetailResponse updateExamPaperAccess(UUID id, UpdateExamPaperAccessRequest request);

    void deleteExamPaper(UUID id);
}
