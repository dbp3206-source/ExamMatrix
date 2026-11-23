package com.exammatrix.backend.service;

import java.time.Duration;

public interface RateLimiterService {
    /**
     * Tries to acquire 1 request token for the given key within a time window.
     *
     * @param key unique limiter key (e.g. "rl:login:127.0.0.1")
     * @param maxRequests maximum allowed requests within window
     * @param window duration of the rate limit window
     * @return true if request is allowed, false if limit exceeded
     */
    boolean tryAcquire(String key, int maxRequests, Duration window);

    /**
     * Checks remaining requests for the key in current window.
     */
    long getRemainingRequests(String key, int maxRequests, Duration window);
}
