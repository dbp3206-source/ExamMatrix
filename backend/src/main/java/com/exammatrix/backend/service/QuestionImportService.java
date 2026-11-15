package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.ImportQuestionsConfirmRequest;
import com.exammatrix.backend.dto.response.ImportQuestionsPreviewResponse;
import com.exammatrix.backend.dto.response.QuestionResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface QuestionImportService {
    ImportQuestionsPreviewResponse previewImport(
            MultipartFile file,
            Integer subjectId,
            Integer chapterId
    );

    List<QuestionResponse> confirmImport(ImportQuestionsConfirmRequest request);
}
