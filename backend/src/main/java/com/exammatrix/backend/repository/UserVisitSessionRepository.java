package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.UserVisitSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserVisitSessionRepository extends JpaRepository<UserVisitSession, UUID> {
    Optional<UserVisitSession> findFirstByUser_IdOrderByLastActivityAtDesc(UUID userId);

    @Query("""
            SELECT s.visitDate, s.roleName, COUNT(s.id)
            FROM UserVisitSession s
            WHERE s.visitDate >= :startDate AND s.visitDate <= :endDate
            GROUP BY s.visitDate, s.roleName
            """)
    List<Object[]> countVisitsByDateAndRole(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
            SELECT s.visitDate, s.roleName, s.user.id, s.user.fullName, COUNT(s.id)
            FROM UserVisitSession s
            WHERE s.visitDate >= :startDate AND s.visitDate <= :endDate
            GROUP BY s.visitDate, s.roleName, s.user.id, s.user.fullName
            """)
    List<Object[]> countVisitsByDateRoleAndUser(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("SELECT MIN(s.visitDate) FROM UserVisitSession s")
    LocalDate findEarliestVisitDate();
}
