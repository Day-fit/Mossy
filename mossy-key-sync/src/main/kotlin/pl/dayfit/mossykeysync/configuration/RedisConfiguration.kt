package pl.dayfit.mossykeysync.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories

@Configuration
@EnableRedisRepositories(basePackages = ["pl.dayfit.mossykeysync.repository.redis"])
class RedisConfiguration