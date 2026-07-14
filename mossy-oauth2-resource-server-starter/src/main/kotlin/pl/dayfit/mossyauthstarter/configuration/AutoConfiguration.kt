package pl.dayfit.mossyauthstarter.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import

@Import(
    value = [
        HttpConfiguration::class,
    ]
)
@Configuration
class AutoConfiguration
