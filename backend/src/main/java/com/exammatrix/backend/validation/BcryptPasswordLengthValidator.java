package com.exammatrix.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class BcryptPasswordLengthValidator implements ConstraintValidator<BcryptPasswordLength, String> {
    private boolean trim;

    @Override
    public void initialize(BcryptPasswordLength constraint) {
        trim = constraint.trim();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) return true;
        String password = trim ? value.trim() : value;
        return password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}
