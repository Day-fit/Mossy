package pl.dayfit.mossymailer.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.mailer.resend")
class ResendConfigurationProperties {
    lateinit var apiKey: String
}