package com.exammatrix.backend.security;

import com.exammatrix.backend.entity.User;

import java.util.Locale;
import java.util.Set;

public final class RolePolicy {
    public static final String ADMIN = "ADMIN";
    public static final String CONTENT_ADMIN = "CONTENT_ADMIN";
    public static final String USER_ADMIN = "USER_ADMIN";
    public static final String TEACHER = "TEACHER";
    public static final String STUDENT = "STUDENT";

    private static final Set<String> CONTENT_STAFF_ROLES = Set.of(ADMIN, CONTENT_ADMIN);
    private static final Set<String> USER_MANAGER_ROLES = Set.of(ADMIN, USER_ADMIN);
    private static final Set<String> ALL_ADMIN_ROLES = Set.of(ADMIN, CONTENT_ADMIN, USER_ADMIN);

    private RolePolicy() {
    }

    public static String normalize(User user) {
        if (user == null || user.getRole() == null || user.getRole().getName() == null) {
            return "";
        }
        return normalize(user.getRole().getName());
    }

    public static String normalize(String roleName) {
        if (roleName == null) {
            return "";
        }
        return roleName.trim().toUpperCase(Locale.ROOT);
    }

    public static boolean isSuperAdmin(User user) {
        return ADMIN.equals(normalize(user));
    }

    public static boolean isSuperAdmin(String roleName) {
        return ADMIN.equals(normalize(roleName));
    }

    public static boolean isContentAdmin(String roleName) {
        return CONTENT_ADMIN.equals(normalize(roleName));
    }

    public static boolean isUserAdmin(String roleName) {
        return USER_ADMIN.equals(normalize(roleName));
    }

    public static boolean isAnyAdmin(User user) {
        return ALL_ADMIN_ROLES.contains(normalize(user));
    }

    public static boolean isContentStaff(User user) {
        return CONTENT_STAFF_ROLES.contains(normalize(user));
    }

    public static boolean isContentStaff(String roleName) {
        return CONTENT_STAFF_ROLES.contains(normalize(roleName));
    }

    public static boolean isUserManager(User user) {
        return USER_MANAGER_ROLES.contains(normalize(user));
    }

    public static boolean isUserManager(String roleName) {
        return USER_MANAGER_ROLES.contains(normalize(roleName));
    }

    public static boolean isTeacher(User user) {
        return TEACHER.equals(normalize(user));
    }

    public static boolean isStudent(User user) {
        return STUDENT.equals(normalize(user));
    }
}
