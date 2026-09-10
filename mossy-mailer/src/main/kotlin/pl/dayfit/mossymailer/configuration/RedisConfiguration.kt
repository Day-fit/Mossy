package pl.dayfit.mossymailer.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.serializer.JdkSerializationRedisSerializer
import org.springframework.data.redis.serializer.StringRedisSerializer
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry

@Configuration
class RedisConfiguration {
    @Bean
    fun redisTemplate(
        connectionFactory: RedisConnectionFactory
    ): RedisTemplate<String, MailCommandStatusEntry> {
        val redisTemplate = RedisTemplate<String, MailCommandStatusEntry>()

        redisTemplate.connectionFactory = connectionFactory
        redisTemplate.keySerializer = StringRedisSerializer()
        redisTemplate.valueSerializer = JdkSerializationRedisSerializer()

        return redisTemplate
    }
}
