package com.exammatrix.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GoogleStudentTokenVerifierTest {
    private final JwtDecoder decoder = mock(JwtDecoder.class);
    private final GoogleStudentTokenVerifier verifier = new GoogleStudentTokenVerifier("web-client", decoder);

    @Test
    void verifiesGoogleClaimsAndBrowserNonce() {
        Jwt valid = identity("web-client", true);
        when(decoder.decode("signed")).thenReturn(valid);
        assertSame(valid, verifier.verify("signed", "browser-nonce"));
        assertUnauthorized("signed", "other-nonce");
        assertUnauthorized("signed", null);
        when(decoder.decode("wrong-client")).thenReturn(identity("other-client", true));
        assertUnauthorized("wrong-client", "browser-nonce");
        when(decoder.decode("unverified")).thenReturn(identity("web-client", false));
        assertUnauthorized("unverified", "browser-nonce");
        when(decoder.decode("bad-signature")).thenThrow(new JwtException("Invalid signature"));
        assertUnauthorized("bad-signature", "browser-nonce");
    }

    private void assertUnauthorized(String credential, String nonce) {
        var exception = assertThrows(ResponseStatusException.class, () -> verifier.verify(credential, nonce));
        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
    }

    private Jwt identity(String clientId, boolean verified) {
        return Jwt.withTokenValue("signed").header("alg", "RS256")
                .issuer("https://accounts.google.com").subject("google-subject")
                .audience(List.of(clientId)).expiresAt(Instant.now().plusSeconds(120))
                .claim("nonce", "browser-nonce").claim("email_verified", verified)
                .build();
    }
}
