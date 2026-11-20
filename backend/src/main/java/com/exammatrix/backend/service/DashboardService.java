package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.response.DashboardResponse;
import com.exammatrix.backend.dto.response.DashboardAnalyticsResponse;

import java.time.LocalDate;

public interface DashboardService {
    DashboardResponse getSummary();

    DashboardAnalyticsResponse getAnalytics();

    DashboardAnalyticsResponse getAnalytics(LocalDate weekStart, Integer subjectId, Integer days);
}
