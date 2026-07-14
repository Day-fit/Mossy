package pl.dayfit.mossyauthstarter.configuration

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import kotlin.collections.ifEmpty

@Configuration
@EnableConfigurationProperties(SecurityConfigurationProperties::class)
/**
 * Shared HTTP security beans for Mossy resource services.
 *
 * Services import this configuration and provide their own security filter chain
 * and JWT decoder URI.
 */
class HttpConfiguration {
    private val logger = LoggerFactory.getLogger(HttpConfiguration::class.java)

    /**
     * Converts the `roles` JWT claim into Spring authorities prefixed with `ROLE_`.
     */
    @Bean
    fun jwtAuthenticationConverter(): JwtAuthenticationConverter {
        val converter = JwtGrantedAuthoritiesConverter().apply {
            setAuthoritiesClaimName("roles")
            setAuthorityPrefix("ROLE_")
        }

        return JwtAuthenticationConverter().apply {
            setJwtGrantedAuthoritiesConverter(converter)
        }
    }

    /**
     * Applies the configured origins to every endpoint. An empty origin list is an
     * explicit development-friendly fallback that permits all origins.
     */
    @Bean
    fun corsConfigurationSource(securityConfigurationProperties: SecurityConfigurationProperties): CorsConfigurationSource
    {
        val corsConfiguration = CorsConfiguration()
        val allowedOrigins = securityConfigurationProperties.allowedOrigins
        corsConfiguration.allowCredentials = true
        corsConfiguration.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        corsConfiguration.allowedOriginPatterns = allowedOrigins.ifEmpty {
            logger.warn("Allowed origins list is empty, CORS allowed for all origins")
            return@ifEmpty listOf("*")
        }

        val urlBasedCorsConfigurationSource = UrlBasedCorsConfigurationSource()
        urlBasedCorsConfigurationSource.registerCorsConfiguration("/**", corsConfiguration)
        return urlBasedCorsConfigurationSource
    }
}
