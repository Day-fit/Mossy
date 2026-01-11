package pl.dayfit.mossycore.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.password")
class PasswordConfigurationProperties {
    val lengthInBytes: Int = 32
}