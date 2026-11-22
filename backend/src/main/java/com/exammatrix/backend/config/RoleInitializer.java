package com.exammatrix.backend.config;

import com.exammatrix.backend.entity.Role;
import com.exammatrix.backend.repository.RoleRepository;
import com.exammatrix.backend.security.RolePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class RoleInitializer implements ApplicationRunner {
    private static final List<String> REQUIRED_ROLES = List.of(
            RolePolicy.ADMIN,
            RolePolicy.CONTENT_ADMIN,
            RolePolicy.USER_ADMIN,
            RolePolicy.TEACHER,
            RolePolicy.STUDENT
    );

    private final RoleRepository roleRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String roleName : REQUIRED_ROLES) {
            if (roleRepository.findByNameIgnoreCase(roleName).isEmpty()) {
                roleRepository.save(Role.builder().name(roleName).build());
            }
        }
    }
}
