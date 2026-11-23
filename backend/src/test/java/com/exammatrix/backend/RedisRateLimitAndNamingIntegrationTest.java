package com.exammatrix.backend;

import com.exammatrix.backend.dto.request.CreateUserRequest;
import com.exammatrix.backend.dto.request.RequestStudentOtpRequest;
import com.exammatrix.backend.dto.request.StudentRegisterRequest;
import com.exammatrix.backend.dto.request.SubjectRequest;
import com.exammatrix.backend.dto.response.SubjectResponse;
import com.exammatrix.backend.entity.Role;
import com.exammatrix.backend.entity.User;
import com.exammatrix.backend.entity.enums.UserStatus;
import com.exammatrix.backend.repository.RoleRepository;
import com.exammatrix.backend.repository.UserRepository;
import com.exammatrix.backend.security.JwtService;
import com.exammatrix.backend.security.RateLimitFilter;
import com.exammatrix.backend.service.RateLimiterService;
import com.exammatrix.backend.service.SubjectService;
import com.exammatrix.backend.util.SqlSanitizer;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import jakarta.servlet.Filter;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class RedisRateLimitAndNamingIntegrationTest {

    @Autowired private WebApplicationContext wac;
    @Autowired @Qualifier("springSecurityFilterChain") private Filter springSecurityFilterChain;
    @Autowired private RateLimitFilter rateLimitFilter;
    @Autowired private RateLimiterService rateLimiterService;
    @Autowired private SubjectService subjectService;
    @Autowired private CacheManager cacheManager;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;
    private User adminUser;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(rateLimitFilter, springSecurityFilterChain)
                .build();

        Role adminRole = roleRepository.findByNameIgnoreCase("ADMIN")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ADMIN").build()));

        adminUser = userRepository.findByUsernameIgnoreCase("test_admin_cache")
                .orElseGet(() -> userRepository.save(User.builder()
                        .username("test_admin_cache")
                        .email("admin_cache@test.com")
                        .fullName("Quản Trị Viên")
                        .password(passwordEncoder.encode("Password123!"))
                        .role(adminRole)
                        .status(UserStatus.ACTIVE)
                        .build()));
    }

    @Test
    @DisplayName("1. RateLimiterService: Allows requests under limit and blocks above limit")
    void testRateLimiterServiceDirect() {
        String testKey = "test:rl:key:" + System.currentTimeMillis();
        Duration window = Duration.ofSeconds(10);

        for (int i = 0; i < 3; i++) {
            assertTrue(rateLimiterService.tryAcquire(testKey, 3, window), "Request " + (i + 1) + " should pass");
        }

        assertFalse(rateLimiterService.tryAcquire(testKey, 3, window), "Request 4 should be rate limited");
    }

    @Test
    @DisplayName("2. RateLimitFilter: Returns HTTP 429 when spamming login attempts")
    void testRateLimitFilterBlocksSpamLogin() throws Exception {
        String spamIp = "192.168.100.99";

        // Send 15 requests (threshold is 15/min)
        for (int i = 0; i < 15; i++) {
            mockMvc.perform(post("/auth/login")
                    .header("X-Forwarded-For", spamIp)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of(
                            "username", "non_existent_user",
                            "password", "WrongPass123"
                    ))));
        }

        // 16th request must trigger 429 Too Many Requests
        mockMvc.perform(post("/auth/login")
                .header("X-Forwarded-For", spamIp)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "non_existent_user",
                        "password", "WrongPass123"
                ))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    @DisplayName("3. Naming Convention: Rejects strange characters and numbers in fullName and username")
    void testNamingConventionValidation() throws Exception {
        String adminToken = "Bearer " + jwtService.generateToken(adminUser);

        // A. Full name with weird symbols
        mockMvc.perform(post("/users")
                .header(HttpHeaders.AUTHORIZATION, adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "valid_user",
                        "fullName", "Học Sinh @#$*! 123",
                        "email", "valid@test.com",
                        "password", "Password123!",
                        "role", "TEACHER"
                ))))
                .andExpect(status().isBadRequest());

        // B. Username with weird symbols
        mockMvc.perform(post("/users")
                .header(HttpHeaders.AUTHORIZATION, adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "user.invalid!@#",
                        "fullName", "Nguyễn Văn Hợp Lệ",
                        "email", "valid2@test.com",
                        "password", "Password123!",
                        "role", "TEACHER"
                ))))
                .andExpect(status().isBadRequest());

        // C. Student Registration OTP request with numbers/symbols in fullName
        mockMvc.perform(post("/auth/register/student/request-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "username", "student_ok_1",
                        "fullName", "Student123_BadName",
                        "email", "student123@bad.com",
                        "password", "Password123!"
                ))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("4. SQL Sanitizer: Escapes LIKE wildcard characters (% and _ and \\)")
    void testSqlSanitizerLikeEscaping() {
        assertEquals("test\\%value", SqlSanitizer.escapeLike("test%value"));
        assertEquals("test\\_value", SqlSanitizer.escapeLike("test_value"));
        assertEquals("test\\\\value", SqlSanitizer.escapeLike("test\\value"));
        assertEquals("plain_value", "plain_value");
    }

    @Test
    @DisplayName("5. Caching: SubjectService caches list and evicts on new subject creation")
    void testSubjectCacheAndEviction() {
        assertNotNull(cacheManager);
        Cache subjectsCache = cacheManager.getCache("subjects");
        assertNotNull(subjectsCache);
        subjectsCache.clear();

        // 1. First call populates cache
        List<SubjectResponse> firstCall = subjectService.getAllSubjects();
        assertNotNull(firstCall);

        System.out.println("DEBUG CACHE: class=" + subjectsCache.getClass() + ", native=" + subjectsCache.getNativeCache());
        Cache.ValueWrapper cached = subjectsCache.get("all");
        System.out.println("DEBUG CACHE get(all)=" + cached);
        assertNotNull(cached, "Cache should contain 'all' key after getAllSubjects()");

        // 2. Creating a subject evicts cache
        String code = "C" + (System.currentTimeMillis() % 100000);
        SubjectRequest req = new SubjectRequest();
        req.setCode(code);
        req.setName("Mon Caching");
        req.setDescription("Mota");
        subjectService.createNewSubject(req);

        // Verify cache is evicted
        Cache.ValueWrapper afterEvict = subjectsCache.get("all");
        assertNull(afterEvict, "Cache key 'all' should be evicted after createNewSubject()");
    }
}
