package pl.dayfit.mossydevicetrust.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfigurationSource
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties

@Configuration
@EnableWebSecurity
class SecurityConfiguration {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        securityConfigurationProperties: SecurityConfigurationProperties,
        corsConfigurationSource: CorsConfigurationSource,
        jwtAuthenticationConverter: JwtAuthenticationConverter
    ): SecurityFilterChain {
        return http
            .securityMatcher("/**")
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .cors { it.configurationSource(corsConfigurationSource) }
            .csrf { it.disable() }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .logout { it.disable() }
            .oauth2ResourceServer {
                it.jwt { jwt ->
                    jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)
                }
            }
            .authorizeHttpRequests {
                it.requestMatchers(*securityConfigurationProperties.publicRoutesPatterns.toTypedArray()).permitAll()
                it.requestMatchers(HttpMethod.POST, "/device/enrollment")
                    .hasAuthority("SCOPE_device.enrollment.start")
                it.requestMatchers(HttpMethod.POST, "/device/enrollment/challenge")
                    .hasAuthority("SCOPE_device.enrollment.challenge")
                it.requestMatchers("/internal/**")
                    .hasAuthority("SCOPE_device.trust.internal")
                it.anyRequest()
                    .hasAuthority("SCOPE_user.access")
            }
            .build()
    }
}
