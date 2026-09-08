package pl.dayfit.mossyauthstarter.configuration

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.security.oauth2.jwt.JwtClaimValidator
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtIssuerValidator
import org.springframework.security.oauth2.jwt.JwtTypeValidator
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import pl.dayfit.mossyauthstarter.type.AudienceType

@Configuration
class JwtDecoderConfiguration {
    @Bean
    @Primary
    fun jwtDecoder(
        @Value("\${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") jwkSetUri: String
    ): JwtDecoder {
        val accessAudiences = setOf(
            AudienceType.MOSSY_USER_API.toString(),
            AudienceType.MOSSY_INTERNAL_API.toString(),
        )
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
            .validateType(false)
            .build()
            .apply {
                setJwtValidator(JwtValidators.createDefaultWithValidators(
                    JwtTypeValidator("at+jwt", "application/at+jwt"),
                    JwtIssuerValidator("mossy-auth"),
                    JwtClaimValidator<List<String>>("aud") { audiences ->
                        !audiences.isNullOrEmpty() && audiences.all { it in accessAudiences }
                    },
                ))
            }
    }
}
