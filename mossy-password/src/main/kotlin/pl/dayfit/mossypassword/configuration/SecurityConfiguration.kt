package pl.dayfit.mossypassword.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthenticationProvider
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossyauthstarter.filter.BearerTokenFilter

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityConfigurationProperties::class)
class SecurityConfiguration {
    private val logger = org.slf4j.LoggerFactory.getLogger(this::class.java)

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        securityConfigurationProperties: SecurityConfigurationProperties,
        bearerTokenFilter: BearerTokenFilter,
        jwtAuthenticationProvider: JwtAuthenticationProvider,
        corsConfigurationSource: CorsConfigurationSource
    ): SecurityFilterChain {
        return http
            .securityMatcher("/**")
            .authenticationProvider(jwtAuthenticationProvider)
            .cors { it.configurationSource(corsConfigurationSource) }
            .csrf { it.disable() }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers(*securityConfigurationProperties.publicRoutesPatterns.toTypedArray()).permitAll()
                it.anyRequest().authenticated()
            }
            .addFilterBefore(bearerTokenFilter, UsernamePasswordAuthenticationFilter::class.java)
            .build()
    }

    @Bean fun corsConfigurationSource(securityConfigurationProperties: SecurityConfigurationProperties): CorsConfigurationSource
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

    @Bean
    fun authenticationManager(authenticationConfiguration: AuthenticationConfiguration): AuthenticationManager {
        return authenticationConfiguration.authenticationManager
    }
}