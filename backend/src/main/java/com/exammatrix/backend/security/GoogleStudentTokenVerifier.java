package com.exammatrix.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Component
public class GoogleStudentTokenVerifier {
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
    private final String clientId;
    private final JwtDecoder decoder;

    @Autowired
    public GoogleStudentTokenVerifier(@Value("${app.google.client-id:}") String clientId) {
        this(clientId, googleDecoder());
    }

    GoogleStudentTokenVerifier(String clientId, JwtDecoder decoder) {
        this.clientId = clientId.trim();
        this.decoder = decoder;
    }

    private static JwtDecoder googleDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
        decoder.setJwtValidator(JwtValidators.createDefault());
        return decoder;
    }

    public String getClientId() {
        if (clientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Đăng nhập Google chưa được cấu hình");
        }
        return clientId;
    }

    public Jwt verify(String credential, String nonce) {
        String audience = getClientId();
        if (nonce == null || nonce.isBlank()) {
            throw invalidCredential();
        }
        try {
            Jwt jwt = decoder.decode(credential);
            String issuer = jwt.getClaimAsString("iss");
            String authorizedParty = jwt.getClaimAsString("azp");
            if (issuer == null || !ISSUERS.contains(issuer)
                    || jwt.getExpiresAt() == null
                    || jwt.getAudience() == null || !jwt.getAudience().contains(audience)
                    || (authorizedParty == null ? jwt.getAudience().size() != 1 : !audience.equals(authorizedParty))
                    || !nonce.equals(jwt.getClaimAsString("nonce"))
                    || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
                    || jwt.getSubject() == null || jwt.getSubject().isBlank() || jwt.getSubject().length() > 255) {
                throw invalidCredential();
            }
            return jwt;
        } catch (JwtException | IllegalArgumentException exception) {
            throw invalidCredential();
        }
    }

    private ResponseStatusException invalidCredential() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Xác thực Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại");
    }
}
