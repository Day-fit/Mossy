package pl.dayfit.mossypassword.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import java.security.SecureRandom

@Configuration
class ApiKeysConfiguration {
    @Bean
    fun secureRandom() = SecureRandom()

    @Bean
    fun passwordEncoder() = BCryptPasswordEncoder(12)
}