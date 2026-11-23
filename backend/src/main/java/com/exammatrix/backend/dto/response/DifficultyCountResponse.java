package com.exammatrix.backend.dto.response;

import com.exammatrix.backend.entity.enums.Difficulty;
import lombok.*;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DifficultyCountResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private Difficulty difficulty;
    private Long count;
}
