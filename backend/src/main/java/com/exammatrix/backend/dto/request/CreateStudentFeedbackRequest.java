package com.exammatrix.backend.dto.request;

import com.exammatrix.backend.entity.enums.FeedbackCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateStudentFeedbackRequest {
    @NotNull(message = "Vui lòng chọn loại góp ý")
    private FeedbackCategory category;

    @NotBlank(message = "Tiêu đề không được để trống")
    @Size(min = 3, max = 200, message = "Tiêu đề phải từ 3 đến 200 ký tự")
    private String title;

    @NotBlank(message = "Nội dung không được để trống")
    @Size(min = 5, max = 3000, message = "Nội dung phải từ 5 đến 3000 ký tự")
    private String content;
}
