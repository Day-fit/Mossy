package pl.dayfit.mossyauth.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import pl.dayfit.mossyauth.service.UserDetailsService

@Configuration
class CredentialsAuthenticationConfiguration {
    @Bean
    fun passwordEncoder() = BCryptPasswordEncoder(12)

    @Bean
    fun daoAuthenticationProvider(
        passwordEncoder: PasswordEncoder,
        userDetailsService: UserDetailsService
    ): DaoAuthenticationProvider
    {
        val provider = DaoAuthenticationProvider(userDetailsService)
        provider.setPasswordEncoder(passwordEncoder)
        return provider
    }
}