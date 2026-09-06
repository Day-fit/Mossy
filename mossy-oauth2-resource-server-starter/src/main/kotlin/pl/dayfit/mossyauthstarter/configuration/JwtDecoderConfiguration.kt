package pl.dayfit.mossyauthstarter.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.jwt.JwtDecoder

@Configuration
class JwtDecoderConfiguration {
    @Bean
    fun jwtDecoder(jwtDecoder: JwtDecoder): JwtDecoder {
        jwtDecoder
    }
}