package pl.dayfit.mossydevicetrust.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import pl.dayfit.mossydevicetrust.configuration.properties.CryptoConfigurationProperties
import java.security.SecureRandom

@Configuration
@EnableConfigurationProperties(CryptoConfigurationProperties::class)
class CryptoConfiguration {
    @Bean
    fun secureRandom() = SecureRandom()
}