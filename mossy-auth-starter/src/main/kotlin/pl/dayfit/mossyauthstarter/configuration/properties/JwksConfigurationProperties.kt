package pl.dayfit.mossyauthstarter.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties("mossy.jwks")
class JwksConfigurationProperties {
    lateinit var jwksProviderUri: String
    lateinit var jwksQueueName: String
    var maxRefreshRate: Duration = Duration.ofSeconds(30)
}