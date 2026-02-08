package pl.dayfit.mossyauth.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.auth.cookies")
class CookiesConfigurationProperties {
    var secure: Boolean = true
}