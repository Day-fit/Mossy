package pl.dayfit.mossyauthstarter.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.security")
class SecurityConfigurationProperties {
    var allowedOrigins: List<String> = listOf()
    var publicRoutesPatterns: List<String> = listOf()
}