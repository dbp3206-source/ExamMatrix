package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.GenerationAdviceRequest;
import com.exammatrix.backend.dto.response.GenerationAdviceResponse;
import com.exammatrix.backend.entity.ExamMatrix;

import java.util.UUID;

public interface GenerationAdviceService {
    GenerationAdviceResponse getGenerationAdvice(UUID matrixId, GenerationAdviceRequest request);

    GenerationAdviceResponse evaluateForLockedMatrix(ExamMatrix matrix, int numberOfPapers);
}
