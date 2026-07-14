package pl.dayfit.mossyauthstarter.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthenticationProvider
import pl.dayfit.mossyauthstarter.filter.entrypoint.GlobalAuthenticationEntryPoint

@Import(
    value = [
        HttpConfiguration::class,
        JwksConfiguration::class,
    ]
)
@Configuration
class AutoConfiguration