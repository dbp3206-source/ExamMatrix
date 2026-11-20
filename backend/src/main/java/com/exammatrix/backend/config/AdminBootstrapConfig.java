package com.exammatrix.backend.config;

import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.RoleRepository;
import com.exammatrix.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Configuration
@ConditionalOnProperty(name = "bootstrap.admin.enabled", havingValue = "true")
public class AdminBootstrapConfig {
    @Bean
    ApplicationRunner bootstrapAdmin(UserRepository users, RoleRepository roles, PasswordEncoder passwords,
                                     @Value("${BOOTSTRAP_ADMIN_USERNAME:}") String configuredUsername,
                                     @Value("${BOOTSTRAP_ADMIN_EMAIL:}") String configuredEmail,
                                     @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String password) {
        return args -> {
            if (users.existsByRole_NameIgnoreCase("ADMIN")) {
                return;
            }
            String username = configuredUsername.strip().toLowerCase(Locale.ROOT);
            String email = configuredEmail.strip().toLowerCase(Locale.ROOT);
            if (!username.matches("[a-z0-9._-]{3,50}") || email.length() > 100
                    || !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
                    || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
                throw new IllegalStateException("Cấu hình tài khoản quản trị ban đầu không hợp lệ");
            }
            if (users.existsByUsernameIgnoreCase(username) || users.existsByEmailIgnoreCase(email)) {
                throw new IllegalStateException("Tên hoặc email quản trị ban đầu đã được sử dụng");
            }
            var role = roles.findByNameIgnoreCase("ADMIN").orElseThrow(() ->
                    new IllegalStateException("Chưa có vai trò quản trị. Hãy chạy script khởi tạo schema"));
            users.save(User.builder().username(username).email(email).fullName("Quản trị viên")
                    .password(passwords.encode(password)).role(role).status(UserStatus.ACTIVE).build());
        };
    }
}
