package pl.dayfit.mossyauth.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.auth")
class MossyAuthConfigurationProperties {
    lateinit var jwkUploadUrl: String
}