package pl.dayfit.mossyauth.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories
import org.springframework.data.redis.serializer.GenericToStringSerializer
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer
import tools.jackson.databind.ObjectMapper

@Configuration
@EnableRedisRepositories(basePackages = ["pl.dayfit.mossyauth.repository.redis"])
class RedisConfiguration {
    @Bean
    fun verificationReservationRedisTemplate(
        connectionFactory: RedisConnectionFactory,
        objectMapper: ObjectMapper
    ): RedisTemplate<String, Boolean> = RedisTemplate<String, Boolean>().apply {
        setConnectionFactory(connectionFactory)
        keySerializer = GenericToStringSerializer(String::class.java)
        valueSerializer = JacksonJsonRedisSerializer(objectMapper, Boolean::class.javaObjectType)
        afterPropertiesSet()
    }
}
