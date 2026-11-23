package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.SubjectRequest;
import com.exammatrix.backend.dto.response.SubjectResponse;
import com.exammatrix.backend.entity.Subject;
import com.exammatrix.backend.repository.ChapterRepository;
import com.exammatrix.backend.repository.ExamMatrixRepository;
import com.exammatrix.backend.repository.SubjectRepository;
import com.exammatrix.backend.service.SubjectService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubjectServiceImpl implements SubjectService {
    private final SubjectRepository subjectRepository;
    private final ChapterRepository chapterRepository;
    private final ExamMatrixRepository examMatrixRepository;
    private final EntityManager entityManager;

    @Override
    @Cacheable(value = "subjects", key = "'all'")
    public List<SubjectResponse> getAllSubjects() {
        List<Subject> subjects = subjectRepository.findAll();

        List<SubjectResponse> responses = new ArrayList<>();

        for (Subject subject : subjects) {
            SubjectResponse response = convertToResponse(subject);
            responses.add(response);
        }

        return responses;
    }

    @Override
    @Cacheable(value = "subjects", key = "#id")
    public SubjectResponse getSubjectById(Integer id) {
        Subject subject = findSubjectById(id);

        return convertToResponse(subject);
    }

    @Override
    @Transactional
    @CacheEvict(value = "subjects", allEntries = true)
    public SubjectResponse createNewSubject(SubjectRequest request) {
        String code = request.getCode()
                .trim()
                .toUpperCase();

        boolean codeExisted = subjectRepository.existsByCodeIgnoreCase(code);

        if (codeExisted) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Mã môn học đã tồn tại"
            );
        }

        Subject subject = new Subject();

        subject.setCode(code);
        subject.setName(request.getName().trim());
        subject.setDescription(request.getDescription());

        Subject savedSubject = subjectRepository.save(subject);

        return convertToResponse(savedSubject);
    }

    @Override
    @Transactional
    @CacheEvict(value = "subjects", allEntries = true)
    public SubjectResponse updateSubjectById(Integer id, SubjectRequest request) {
        Subject subject = findSubjectById(id);

        String code = request.getCode()
                .trim()
                .toUpperCase();
        boolean existCodeOnAnotherSubject = subjectRepository.existsByCodeIgnoreCaseAndIdNot(code, id);
        if (existCodeOnAnotherSubject) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Mã môn học đã được sử dụng"
            );
        }

        subject.setCode(code);
        subject.setName(request.getName().trim());
        subject.setDescription(request.getDescription());

        Subject savedSubject = subjectRepository.save(subject);

        return convertToResponse(savedSubject);
    }

    @Override
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "subjects", allEntries = true),
            @CacheEvict(value = "chapters", allEntries = true)
    })
    public void deleteSubjectById(Integer id) {
        Subject subject = findSubjectById(id);

        if (isCurrentUserAdmin()) {
            cascadeDeleteSubjectDependencies(id);
            entityManager.flush();
            entityManager.clear();
            subjectRepository.deleteById(id);
            subjectRepository.flush();
            return;
        }

        if (chapterRepository.existsBySubjectId(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa môn học đang có chương bài"
            );
        }

        if (examMatrixRepository.existsBySubject_Id(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa môn học đang được dùng trong ma trận đề"
            );
        }

        try {
            subjectRepository.delete(subject);
            subjectRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa môn học đang được sử dụng"
            );
        }
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private void cascadeDeleteSubjectDependencies(Integer subjectId) {
        entityManager.createNativeQuery(
                "DELETE FROM student_attempt_answer_choices WHERE attempt_answer_id IN (" +
                "SELECT saa.id FROM student_attempt_answers saa " +
                "LEFT JOIN student_exam_attempts sea ON sea.id = saa.attempt_id " +
                "LEFT JOIN exam_papers ep ON ep.id = sea.exam_paper_id " +
                "LEFT JOIN exam_matrices em ON em.id = ep.matrix_id " +
                "LEFT JOIN questions q ON q.id = saa.question_id " +
                "LEFT JOIN chapters ch ON ch.id = q.chapter_id " +
                "WHERE em.subject_id = :subjectId OR ch.subject_id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM StudentAttemptAnswer saa WHERE saa.attempt.id IN (" +
                "SELECT sea.id FROM StudentExamAttempt sea WHERE sea.examPaper.examMatrix.subject.id = :subjectId) " +
                "OR saa.question.id IN (SELECT q.id FROM Question q WHERE q.chapter.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM StudentExamAttempt sea WHERE sea.examPaper.id IN (" +
                "SELECT ep.id FROM ExamPaper ep WHERE ep.examMatrix.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM PaperQuestion pq WHERE pq.examPaper.id IN (" +
                "SELECT ep.id FROM ExamPaper ep WHERE ep.examMatrix.subject.id = :subjectId) " +
                "OR pq.question.id IN (SELECT q.id FROM Question q WHERE q.chapter.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM ExamPaper ep WHERE ep.examMatrix.id IN (" +
                "SELECT em.id FROM ExamMatrix em WHERE em.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM ExamGenerationRequest r WHERE r.examMatrix.id IN (" +
                "SELECT em.id FROM ExamMatrix em WHERE em.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM ExamMatrixConfig mc WHERE mc.examMatrix.id IN (" +
                "SELECT em.id FROM ExamMatrix em WHERE em.subject.id = :subjectId) " +
                "OR mc.chapter.id IN (SELECT c.id FROM Chapter c WHERE c.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM ExamMatrix em WHERE em.subject.id = :subjectId"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM Answer a WHERE a.question.id IN (" +
                "SELECT q.id FROM Question q WHERE q.chapter.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM Question q WHERE q.chapter.id IN (" +
                "SELECT c.id FROM Chapter c WHERE c.subject.id = :subjectId)"
        ).setParameter("subjectId", subjectId).executeUpdate();

        entityManager.createQuery(
                "DELETE FROM Chapter c WHERE c.subject.id = :subjectId"
        ).setParameter("subjectId", subjectId).executeUpdate();
    }

    private Subject findSubjectById(Integer id) {
        Optional<Subject> result = subjectRepository.findById(id);

        if (result.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy môn học có id " + id
            );
        }

        return result.get();
    }

    private SubjectResponse convertToResponse(Subject subject) {
        SubjectResponse response = new SubjectResponse();

        response.setId(subject.getId());
        response.setCode(subject.getCode());
        response.setName(subject.getName());
        response.setDescription(subject.getDescription());

        return response;
    }
}
