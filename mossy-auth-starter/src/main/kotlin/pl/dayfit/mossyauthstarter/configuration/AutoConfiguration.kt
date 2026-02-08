package pl.dayfit.mossyauthstarter.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import pl.dayfit.mossyauthstarter.jwks.StarterJwksProvider
import pl.dayfit.mossyauthstarter.service.JwtClaimsService

@Import(
    value = [
        JwksConfiguration::class,
        StarterJwksProvider::class,
        JwtClaimsService::class,
        StarterJwksProvider::class,
        SecurityConfiguration::class
    ]
)
@Configuration
class AutoConfiguration {
}