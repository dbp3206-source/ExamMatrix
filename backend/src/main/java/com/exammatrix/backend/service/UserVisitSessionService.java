package com.exammatrix.backend.service;

import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.UserVisitSession;
import com.exammatrix.backend.repository.UserVisitSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserVisitSessionService {
    public static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final long SESSION_TIMEOUT_MINUTES = 30L;

    private final UserVisitSessionRepository visitSessionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordActivity(User user) {
        if (user == null || user.getId() == null || user.getRole() == null || user.getRole().getName() == null) {
            return;
        }
        String roleName = user.getRole().getName().trim().toUpperCase(Locale.ROOT);
        if (!"TEACHER".equals(roleName) && !"STUDENT".equals(roleName) && !"ADMIN".equals(roleName)) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(VIETNAM_ZONE);
        LocalDate today = now.toLocalDate();

        try {
            Optional<UserVisitSession> latestOpt = visitSessionRepository
                    .findFirstByUser_IdOrderByLastActivityAtDesc(user.getId());

            if (latestOpt.isPresent()) {
                UserVisitSession latest = latestOpt.get();
                long inactiveMinutes = Duration.between(latest.getLastActivityAt(), now).toMinutes();
                if (today.equals(latest.getVisitDate()) && inactiveMinutes < SESSION_TIMEOUT_MINUTES) {

                    if (Duration.between(latest.getLastActivityAt(), now).toSeconds() >= 60) {
                        latest.setLastActivityAt(now);
                        visitSessionRepository.save(latest);
                    }
                    return;
                }
            }

            UserVisitSession newSession = UserVisitSession.builder()
                    .user(user)
                    .roleName(roleName)
                    .visitDate(today)
                    .startedAt(now)
                    .lastActivityAt(now)
                    .build();
            visitSessionRepository.save(newSession);
        } catch (Exception ex) {
            log.debug("Could not record visit session for user {}: {}", user.getId(), ex.getMessage());
        }
    }
}
