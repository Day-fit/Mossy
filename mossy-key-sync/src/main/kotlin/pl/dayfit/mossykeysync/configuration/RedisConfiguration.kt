package pl.dayfit.mossykeysync.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer
import org.springframework.data.redis.serializer.StringRedisSerializer
import pl.dayfit.mossykeysync.model.redis.KeySyncInfo
import tools.jackson.databind.ObjectMapper

@Configuration
@EnableRedisRepositories(basePackages = ["pl.dayfit.mossykeysync.repository.redis"])
class RedisConfiguration {
    @Bean
    fun keySyncRedisTemplate(
        connectionFactory: RedisConnectionFactory,
        objectMapper: ObjectMapper,
    ): RedisTemplate<String, KeySyncInfo> = RedisTemplate<String, KeySyncInfo>().apply {
        setConnectionFactory(connectionFactory)
        keySerializer = StringRedisSerializer()
        hashKeySerializer = StringRedisSerializer()
        valueSerializer = JacksonJsonRedisSerializer(objectMapper, KeySyncInfo::class.java)
        hashValueSerializer = valueSerializer
    }
}
