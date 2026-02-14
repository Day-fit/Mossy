package pl.dayfit.mossyauth.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "mossy.auth.jwt")
class JwtConfigurationProperties {
    var accessTokenExpirationTime: Duration = Duration.ofMinutes(15)
    var refreshTokenExpirationTime: Duration = Duration.ofDays(14)
}