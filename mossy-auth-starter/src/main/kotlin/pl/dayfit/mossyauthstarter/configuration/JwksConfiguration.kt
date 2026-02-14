package pl.dayfit.mossyauthstarter.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestTemplate
import pl.dayfit.mossyauthstarter.configuration.properties.JwksConfigurationProperties

@Configuration
@EnableConfigurationProperties(JwksConfigurationProperties::class)
class JwksConfiguration {
    @Bean
    fun starterJwksTemplate() = RestTemplate()
}