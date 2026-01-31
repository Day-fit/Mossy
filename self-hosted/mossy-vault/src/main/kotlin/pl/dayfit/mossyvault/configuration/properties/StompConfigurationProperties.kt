package pl.dayfit.mossyvault.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.stomp")
data class StompConfigurationProperties(
    val host: String
)