package com.exammatrix.backend.util;

/**
 * Utility to escape wildcard characters in LIKE and ILIKE SQL/JPQL queries
 * to prevent unintentional full-table scans or wildcard abuse.
 */
public final class SqlSanitizer {

    private SqlSanitizer() {}

    public static String escapeLike(String input) {
        if (input == null) {
            return null;
        }
        return input
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
