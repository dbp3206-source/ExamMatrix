package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.dto.request.CreateUserRequest;
import com.exammatrix.backend.dto.request.UpdateUserRequest;
import com.exammatrix.backend.dto.request.UpdateUserStatusRequest;
import com.exammatrix.backend.dto.response.PageResponse;
import com.exammatrix.backend.dto.response.UserResponse;
import com.exammatrix.backend.entity.Role;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.RoleRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.RolePolicy;
import com.exammatrix.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public PageResponse<UserResponse> getAllUsers(
        String search,
        String role,
        UserStatus status,
        Integer page,
        Integer size
    ) {
        int safePage = page == null || page < 0 ? 0 : page;

        int safeSize = size == null || size < 1 ? 10 : size;

        if (safeSize > 100) {
            safeSize = 100;
        }

        String normalizedSearch = normalizeFilter(search);

        String normalizedRole = normalizeFilter(role);

        Pageable pageable = PageRequest.of(
            safePage,
            safeSize,
            Sort.by(
                Sort.Order.desc("createdAt")
            )
        );

        Page<User> userPage = userRepository.searchUsers(
            normalizedSearch,
            normalizedRole,
            status,
            pageable
        );

        List<UserResponse> responses = new ArrayList<>();

        for (User user : userPage.getContent()) {
            responses.add(convertToResponse(user));
        }

        return new PageResponse<>(
            responses,
            userPage.getNumber(),
            userPage.getSize(),
            userPage.getTotalElements(),
            userPage.getTotalPages()
        );
    }

    @Override
    public UserResponse getUserById(UUID id) {
        User user = findUserById(id);

        return convertToResponse(user);
    }

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        String username = request
            .getUsername()
            .trim()
            .toLowerCase(Locale.ROOT);

        String email = request
            .getEmail()
            .trim()
            .toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Tên đăng nhập đã tồn tại"
            );
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Email đã tồn tại"
            );
        }

        String targetRoleName = StringUtils.hasText(request.getRole())
                ? RolePolicy.normalize(request.getRole())
                : RolePolicy.TEACHER;

        if (RolePolicy.isSuperAdmin(targetRoleName) && isCallerRestrictedToUserAdmin()) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Bạn không có quyền tạo tài khoản Admin tổng"
            );
        }

        Role assignedRole = findRoleByName(targetRoleName);

        User user = new User();

        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(request.getFullName().trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(assignedRole);
        user.setStatus(UserStatus.ACTIVE);

        User savedUser = userRepository.save(user);

        return convertToResponse(savedUser);
    }

    @Override
    @Transactional
    public UserResponse updateUserById(UUID id, UpdateUserRequest request) {
        User user = findUserForUpdate(id);
        enforceTargetEditableByCaller(user);

        String email = request
            .getEmail()
            .trim()
            .toLowerCase(Locale.ROOT);

        boolean emailExisted = userRepository.existsByEmailIgnoreCaseAndIdNot(email, id);

        if (emailExisted) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Email đã được sử dụng"
            );
        }

        user.setFullName(request.getFullName().trim());

        user.setEmail(email);

        if (request.getRole() != null && !request.getRole().isBlank()) {
            String normalizedTargetRole = RolePolicy.normalize(request.getRole());
            if (RolePolicy.isSuperAdmin(normalizedTargetRole) && isCallerRestrictedToUserAdmin()) {
                throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền gán vai trò Admin tổng"
                );
            }
            Role role = findRoleByName(normalizedTargetRole);
            if (!role.getId().equals(user.getRole().getId())) {
                if (user.getGoogleSubject() != null) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Không thể đổi vai trò của tài khoản đăng nhập bằng Google");
                }
                user.setRole(role);
                user.invalidateSessions();
            }
        }

        User savedUser = userRepository.save(user);

        return convertToResponse(savedUser);
    }

    @Override
    @Transactional
    public UserResponse updateUserStatus(UUID id, UpdateUserStatusRequest request) {
        User user = findUserForUpdate(id);
        enforceTargetEditableByCaller(user);

        if (user.getStatus() != request.getStatus()) {
            user.setStatus(request.getStatus());
            user.invalidateSessions();
        }

        User savedUser = userRepository.save(user);

        return convertToResponse(savedUser);
    }

    private User findUserById(UUID id) {
        Optional<User> result = userRepository.findById(id);

        if (result.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy người dùng có id " + id
            );
        }

        return result.get();
    }

    private User findUserForUpdate(UUID id) {
        return userRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng có id " + id));
    }

    private Role findRoleByName(String roleName) {
        Optional<Role> result = roleRepository.findByNameIgnoreCase(roleName);

        if (result.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy vai trò " + roleName
            );
        }

        return result.get();
    }

    private UserResponse convertToResponse(User user) {
        String roleName = user
            .getRole()
            .getName()
            .toUpperCase(Locale.ROOT);

        return new UserResponse(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getFullName(),
            roleName,
            user.getStatus(),
            user.getCreatedAt(),
            user.getUpdatedAt()
        );
    }

    private String normalizeFilter(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();

        if (normalized.isEmpty()) {
            return null;
        }

        return com.exammatrix.backend.util.SqlSanitizer.escapeLike(normalized);
    }

    private void enforceTargetEditableByCaller(User target) {
        if (RolePolicy.isSuperAdmin(target) && isCallerRestrictedToUserAdmin()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền chỉnh sửa tài khoản Admin tổng"
            );
        }
    }

    private boolean isCallerRestrictedToUserAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        boolean hasUserAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_USER_ADMIN".equalsIgnoreCase(a.getAuthority()));
        boolean hasSuperAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()));
        return hasUserAdmin && !hasSuperAdmin;
    }
}
