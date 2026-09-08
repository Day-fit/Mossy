package pl.dayfit.mossyauth.configuration

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties

@Configuration
@EnableConfigurationProperties(JwtConfigurationProperties::class)
class JwtConfiguration {
    @Bean
    fun refreshJwtDecoder(
        @Value("\${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") jwkSetUri: String
    ): JwtDecoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build().apply {
        setJwtValidator(JwtValidators.createDefaultWithIssuer("mossy-auth"))
    }
}
