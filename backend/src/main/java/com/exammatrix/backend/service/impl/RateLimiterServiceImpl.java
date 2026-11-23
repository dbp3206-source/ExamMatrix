package com.exammatrix.backend.service.impl;

import com.exammatrix.backend.service.RateLimiterService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class RateLimiterServiceImpl implements RateLimiterService {

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final Map<String, InMemoryWindow> inMemoryCounters = new ConcurrentHashMap<>();

    public RateLimiterServiceImpl(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    @Override
    public boolean tryAcquire(String key, int maxRequests, Duration window) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                Long count = redis.opsForValue().increment(key);
                if (count != null && count == 1) {
                    redis.expire(key, window);
                }
                return count != null && count <= maxRequests;
            } catch (Exception ex) {
                log.warn("Redis rate limiter unavailable for key [{}]: {}. Falling back to in-memory limiter.",
                        key, ex.getMessage());
            }
        }

        return tryAcquireInMemory(key, maxRequests, window);
    }

    @Override
    public long getRemainingRequests(String key, int maxRequests, Duration window) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                String val = redis.opsForValue().get(key);
                long current = (val != null) ? Long.parseLong(val) : 0L;
                return Math.max(0, maxRequests - current);
            } catch (Exception ex) {
                log.warn("Redis read error for limiter key [{}]: {}", key, ex.getMessage());
            }
        }

        InMemoryWindow counter = inMemoryCounters.get(key);
        if (counter == null || counter.isExpired()) {
            return maxRequests;
        }
        return Math.max(0, maxRequests - counter.count.get());
    }

    private boolean tryAcquireInMemory(String key, int maxRequests, Duration window) {
        Instant now = Instant.now();
        InMemoryWindow windowCounter = inMemoryCounters.compute(key, (k, existing) -> {
            if (existing == null || existing.isExpired()) {
                return new InMemoryWindow(now.plus(window));
            }
            return existing;
        });

        int currentCount = windowCounter.count.incrementAndGet();
        cleanExpiredCountersIfNecessary();
        return currentCount <= maxRequests;
    }

    private void cleanExpiredCountersIfNecessary() {
        if (inMemoryCounters.size() > 5000) {
            inMemoryCounters.entrySet().removeIf(entry -> entry.getValue().isExpired());
        }
    }

    private static class InMemoryWindow {
        private final Instant expiresAt;
        private final AtomicInteger count;

        InMemoryWindow(Instant expiresAt) {
            this.expiresAt = expiresAt;
            this.count = new AtomicInteger(0);
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
