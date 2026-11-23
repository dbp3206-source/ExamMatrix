package com.exammatrix.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Configuration
@EnableCaching
public class RedisAndCacheConfig {

    @Value("${app.redis.enabled:true}")
    private boolean redisEnabled;

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Bean
    public RedisTemplate<String, Object> redisTemplate(ObjectProvider<RedisConnectionFactory> factoryProvider) {
        RedisConnectionFactory factory = factoryProvider.getIfAvailable();
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        if (factory != null) {
            template.setConnectionFactory(factory);
        }
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(ObjectProvider<RedisConnectionFactory> factoryProvider) {
        RedisConnectionFactory factory = factoryProvider.getIfAvailable();
        if (factory != null && isRedisReachable(redisHost, redisPort)) {
            return new StringRedisTemplate(factory);
        }
        return null;
    }

    @Bean
    @Primary
    public CacheManager cacheManager(ObjectProvider<RedisConnectionFactory> factoryProvider) {
        RedisConnectionFactory factory = factoryProvider.getIfAvailable();
        if (!redisEnabled || factory == null || !isRedisReachable(redisHost, redisPort)) {
            log.info("Redis is unavailable or disabled at {}:{}. Using In-Memory CacheManager.", redisHost, redisPort);
            return createInMemoryCacheManager();
        }

        try {
            RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofMinutes(10))
                    .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                    .disableCachingNullValues();

            Map<String, RedisCacheConfiguration> cacheConfigs = new HashMap<>();
            cacheConfigs.put("subjects", defaultConfig.entryTtl(Duration.ofMinutes(15)));
            cacheConfigs.put("chapters", defaultConfig.entryTtl(Duration.ofMinutes(15)));
            cacheConfigs.put("dashboard_summary", defaultConfig.entryTtl(Duration.ofMinutes(2)));

            log.info("Redis cache initialized successfully at {}:{}.", redisHost, redisPort);
            return RedisCacheManager.builder(factory)
                    .cacheDefaults(defaultConfig)
                    .withInitialCacheConfigurations(cacheConfigs)
                    .build();
        } catch (Exception ex) {
            log.warn("Cannot initialize RedisCacheManager ({}). Falling back to In-Memory CacheManager.", ex.getMessage());
            return createInMemoryCacheManager();
        }
    }

    private boolean isRedisReachable(String host, int port) {
        try (java.net.Socket socket = new java.net.Socket()) {
            socket.connect(new java.net.InetSocketAddress(host, port), 300);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private CacheManager createInMemoryCacheManager() {
        return new ConcurrentMapCacheManager("subjects", "chapters", "dashboard_summary");
    }
}
