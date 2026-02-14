package pl.dayfit.mossyauth.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties

@Configuration
@EnableConfigurationProperties(JwtConfigurationProperties::class)
class JwtConfiguration
