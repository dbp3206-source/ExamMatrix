package com.exammatrix.backend.repository;

import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.UserStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByGoogleSubject(String googleSubject);

    List<User> findByRole_NameIgnoreCaseAndStatusOrderByFullNameAsc(String role, UserStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.username) = lower(:username)")
    Optional<User> findByUsernameForUpdate(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByRole_NameIgnoreCase(String role);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);

    @Query("""
    SELECT u
    FROM User u
    JOIN u.role r
    WHERE (
        :search IS NULL
        OR LOWER(u.username) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
        OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
        OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
    )
    AND (
        :role IS NULL
        OR LOWER(r.name) = LOWER(CAST(:role AS string))
    )
    AND (
        :status IS NULL
        OR u.status = :status
    )
    """)
    Page<User> searchUsers(
        @Param("search") String search,
        @Param("role") String role,
        @Param("status") UserStatus status,
        Pageable pageable
    );

    @Query("""
        SELECT r.name, u.status, COUNT(u)
        FROM User u
        JOIN u.role r
        GROUP BY r.name, u.status
        ORDER BY r.name, u.status
        """)
    List<Object[]> countByRoleAndStatus();
}
