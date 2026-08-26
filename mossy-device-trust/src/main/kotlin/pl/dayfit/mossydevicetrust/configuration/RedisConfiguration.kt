package pl.dayfit.mossydevicetrust.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.serializer.GenericToStringSerializer
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer
import pl.dayfit.mossydevicetrust.model.NonceChallenge
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@Configuration
class RedisConfiguration {
    @Bean
    fun nonceChallengeRedisTemplate(
        connectionFactory: RedisConnectionFactory,
        objectMapper: ObjectMapper,
    ): RedisTemplate<UUID, NonceChallenge> = RedisTemplate<UUID, NonceChallenge>().apply {
        setConnectionFactory(connectionFactory)
        keySerializer = GenericToStringSerializer(UUID::class.java)
        valueSerializer = JacksonJsonRedisSerializer(objectMapper, NonceChallenge::class.java)
        afterPropertiesSet()
    }

    @Bean
    fun idempotencyRedisTemplate(
        connectionFactory: RedisConnectionFactory,
        objectMapper: ObjectMapper,
    ): RedisTemplate<UUID, Boolean> = RedisTemplate<UUID, Boolean>().apply {
        setConnectionFactory(connectionFactory)
        keySerializer = GenericToStringSerializer(UUID::class.java)
        valueSerializer = JacksonJsonRedisSerializer(objectMapper, Boolean::class.java)
        afterPropertiesSet()
    }
}
