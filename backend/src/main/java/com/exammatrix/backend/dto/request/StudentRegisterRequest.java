package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.validation.BcryptPasswordLength;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentRegisterRequest {
    @NotBlank(message = "Tên đăng nhập không được để trống")
    @Size(min = 3, max = 30, message = "Tên đăng nhập phải từ 3 đến 30 ký tự")
    @Pattern(
        regexp = "^[a-zA-Z0-9_]+$",
        message = "Tên đăng nhập chỉ gồm chữ cái, chữ số và dấu gạch dưới, không chứa ký tự lạ"
    )
    private String username;

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    @Size(max = 100, message = "Email không được vượt quá 100 ký tự")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @BcryptPasswordLength
    private String password;

    @NotBlank(message = "Họ tên không được để trống")
    @Size(min = 2, max = 100, message = "Họ tên phải từ 2 đến 100 ký tự")
    @Pattern(
        regexp = "^[\\p{L}\\p{M} ’'\\-]+$",
        message = "Họ tên chỉ chấp nhận chữ cái và khoảng trắng, không chứa số hoặc ký tự lạ"
    )
    private String fullName;

    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(regexp = "^\\d{6}$", message = "Mã OTP phải gồm đúng 6 chữ số")
    private String otp;
}
