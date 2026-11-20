package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.entity.enums.AttemptStatus;
import com.exammatrix.backend.repository.StudentExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "app.exams.expiry-job-enabled", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class ExamAttemptExpiryJob {
    private final StudentExamAttemptRepository attempts;
    private final StudentExamServiceImpl studentExams;

    @Scheduled(fixedDelay = 30000)
    public void finalizeExpiredAttempts() {
        LocalDateTime now = LocalDateTime.now();
        for (UUID id : attempts.findExpiredIds(AttemptStatus.IN_PROGRESS, now, PageRequest.of(0, 100))) {
            try {
                studentExams.finalizeExpiredAttempt(id, now);
            } catch (RuntimeException exception) {
                log.warn("Unable to finalize expired attempt {} ({})", id, exception.getClass().getSimpleName());
            }
        }
    }
}
