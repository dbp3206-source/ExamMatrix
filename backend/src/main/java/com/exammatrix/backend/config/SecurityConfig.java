package com.exammatrix.backend.config;

import com.exammatrix.backend.security.CustomUserDetailsService;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.service.UserVisitSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Arrays;
import java.util.Locale;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(customUserDetailsService);

        provider.setPasswordEncoder(passwordEncoder);

        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(DaoAuthenticationProvider authenticationProvider) {
        return new ProviderManager(List.of(authenticationProvider));
    }

    @Bean
    public Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter(
            UserRepository users,
            UserVisitSessionService visitSessionService
    ) {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();

        authoritiesConverter.setAuthoritiesClaimName("authorities");

        authoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();

        jwtConverter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);

        return jwt -> {
            var user = users.findByUsernameIgnoreCase(jwt.getSubject())
                .orElseThrow(() -> new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_TOKEN));
            String authority = "ROLE_" + user.getRole().getName().toUpperCase(Locale.ROOT);
            if (user.getStatus() != UserStatus.ACTIVE
                    || !user.getId().toString().equals(jwt.getClaimAsString("userId"))
                    || !user.sessionVersionClaim().equals(jwt.getClaimAsString("sessionVersion"))
                    || !List.of(authority).equals(jwt.getClaimAsStringList("authorities"))) {
                throw new OAuth2AuthenticationException(OAuth2ErrorCodes.INVALID_TOKEN);
            }
            visitSessionService.recordActivity(user);
            return jwtConverter.convert(jwt);
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .distinct()
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowCredentials(true);

        configuration.setAllowedMethods(
            List.of(
                "GET",
                "POST",
                "PATCH",
                "DELETE",
                "OPTIONS"
            )
        );

        configuration.setAllowedHeaders(
            List.of(
                "Authorization",
                "Content-Type"
            )
        );

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
            "/**",
            configuration
        );

        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        DaoAuthenticationProvider authenticationProvider,
        Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter,
        CorsConfigurationSource corsConfigurationSource
    ) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)

            .cors(cors -> cors.configurationSource(
                corsConfigurationSource
            ))

            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )

            .authenticationProvider(
                authenticationProvider
            )

            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    HttpMethod.OPTIONS,
                    "/**"
                ).permitAll()

                .requestMatchers(
                    HttpMethod.POST,
                    "/auth/login",
                    "/auth/google/student/challenge",
                    "/auth/google/student",
                    "/auth/register/student"
                ).permitAll()

                .requestMatchers(
                    HttpMethod.GET,
                    "/actuator/health",
                    "/actuator/health/**"
                ).permitAll()

                .requestMatchers("/student/**")
                .hasRole("STUDENT")

                .requestMatchers(
                    "/teacher/classes",
                    "/teacher/classes/**",
                    "/teacher/student-requests",
                    "/teacher/student-requests/**"
                ).hasRole("TEACHER")

                .requestMatchers("/teacher/**")
                .hasAnyRole("ADMIN", "TEACHER")

                .requestMatchers(
                    "/admin/**",
                    "/roles/**",
                    "/users/**"
                ).hasRole("ADMIN")

                .requestMatchers(
                    HttpMethod.POST,
                    "/subjects/**",
                    "/chapters/**"
                ).hasRole("ADMIN")

                .requestMatchers(
                    HttpMethod.PATCH,
                    "/subjects/**",
                    "/chapters/**"
                ).hasRole("ADMIN")

                .requestMatchers(
                    HttpMethod.DELETE,
                    "/subjects/**",
                    "/chapters/**"
                ).hasRole("ADMIN")

                .requestMatchers("/questions/**")
                .hasAnyRole("ADMIN", "TEACHER")

                .requestMatchers(
                    "/exam-matrices",
                    "/exam-matrices/**"
                ).hasAnyRole("ADMIN", "TEACHER")

                .requestMatchers(
                        "/exam-papers",
                        "/exam-papers/**"
                ).hasAnyRole("ADMIN", "TEACHER")

                .requestMatchers(HttpMethod.GET, "/dashboard/analytics")
                .hasAnyRole("ADMIN", "TEACHER", "STUDENT")

                .requestMatchers("/dashboard/**")
                .hasAnyRole("ADMIN", "TEACHER")

                .anyRequest().authenticated()
            )

            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt ->
                    jwt.jwtAuthenticationConverter(
                        jwtAuthenticationConverter
                    )
                )
            );

        return http.build();
    }
}
