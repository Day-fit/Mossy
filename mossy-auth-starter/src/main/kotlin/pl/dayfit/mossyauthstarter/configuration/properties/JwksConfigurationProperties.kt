package pl.dayfit.mossyauthstarter.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Import
import pl.dayfit.mossyauthstarter.configuration.JwksConfiguration
import pl.dayfit.mossyauthstarter.jwks.StarterJwksProvider
import java.time.Duration

@Import(
    value = [
        JwksConfiguration::class,
        StarterJwksProvider::class
    ]
)
@ConfigurationProperties("mossy.jwks")
class JwksConfigurationProperties {
    lateinit var jwksProviderUri: String
    var maxRefreshRate: Duration = Duration.ofSeconds(30)
}