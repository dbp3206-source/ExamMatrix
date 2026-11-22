package com.exammatrix.backend.service;

import com.exammatrix.backend.dto.request.RequestStudentOtpRequest;
import com.exammatrix.backend.dto.request.ResendStudentOtpRequest;
import com.exammatrix.backend.dto.response.StudentOtpResponse;

public interface StudentOtpService {
    StudentOtpResponse requestOtp(RequestStudentOtpRequest request);

    StudentOtpResponse resendOtp(ResendStudentOtpRequest request);

    void verifyAndConsumeOtp(String email, String rawOtp);
}
