package pl.dayfit.mossycore.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import pl.dayfit.mossycore.configuration.properties.PasswordConfigurationProperties
import java.security.SecureRandom

@Configuration
@EnableConfigurationProperties(PasswordConfigurationProperties::class)
class PasswordGenerationConfiguration {
    @Bean
    fun secureRandom() = SecureRandom()
}