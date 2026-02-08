package pl.dayfit.mossyauthstarter.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityConfigurationProperties::class)
class SecurityConfiguration {
    private val logger = org.slf4j.LoggerFactory.getLogger(SecurityConfiguration::class.java)

    @Bean
    @Order(2)
    fun filterChain(
        http: HttpSecurity,
        securityConfigurationProperties: SecurityConfigurationProperties,
        corsConfigurationSource: CorsConfigurationSource
    ): SecurityFilterChain
    {
        return http
            .securityMatchers {
                it.requestMatchers("/**")
            }
            .cors { it.configurationSource(corsConfigurationSource) }
            .csrf { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers(
                    *securityConfigurationProperties.publicRoutesPatterns.toTypedArray()
                ).permitAll()
                it.anyRequest().authenticated()
            }
            .build()
    }

    @Bean
    fun corsConfigurationSource(securityConfigurationProperties: SecurityConfigurationProperties): CorsConfigurationSource
    {
        val corsConfiguration = CorsConfiguration()
        val allowedOrigins = securityConfigurationProperties.allowedOrigins

        corsConfiguration.allowCredentials = true

        if (allowedOrigins.isEmpty()) {
            logger.warn("Allowed origins list is empty, CORS allowed for all origins")
            corsConfiguration.allowedOriginPatterns = listOf("*")
        }

        val urlBasedCorsConfigurationSource = UrlBasedCorsConfigurationSource()
        urlBasedCorsConfigurationSource.registerCorsConfiguration("/**", corsConfiguration)

        return urlBasedCorsConfigurationSource
    }
}