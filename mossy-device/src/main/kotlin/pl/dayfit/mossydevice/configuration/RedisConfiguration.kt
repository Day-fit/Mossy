package pl.dayfit.mossydevice.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories

@Configuration
@EnableRedisRepositories(basePackages = ["pl.dayfit.mossydevice.repository.redis"])
class RedisConfiguration