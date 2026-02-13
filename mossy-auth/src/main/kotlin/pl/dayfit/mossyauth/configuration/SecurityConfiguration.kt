package pl.dayfit.mossyauth.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfigurationSource
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthorizationProvider
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossyauthstarter.filter.BearerTokenFilter

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityConfigurationProperties::class)
class SecurityConfiguration {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        bearerTokenFilter: BearerTokenFilter,
        jwtAuthorizationProvider: JwtAuthorizationProvider,
        corsConfigurationSource: CorsConfigurationSource
    ): SecurityFilterChain {
        return http
            .securityMatcher("/**")
            .authenticationProvider(jwtAuthorizationProvider)
            .cors { it.configurationSource(corsConfigurationSource) }
            .csrf { it.disable() }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .authorizeHttpRequests {
                it.anyRequest().authenticated()
            }
            .addFilterBefore(bearerTokenFilter, UsernamePasswordAuthenticationFilter::class.java)
            .build()
    }

    @Bean
    fun authenticationManager(authenticationConfiguration: AuthenticationConfiguration): AuthenticationManager {
        return authenticationConfiguration.authenticationManager
    }
}