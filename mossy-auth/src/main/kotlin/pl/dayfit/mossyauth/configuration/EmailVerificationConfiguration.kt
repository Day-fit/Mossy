package pl.dayfit.mossyauth.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

@Configuration
@EnableConfigurationProperties(EmailVerificationProperties::class)
class EmailVerificationConfiguration {
    @Bean
    fun verificationClock(): Clock = Clock.systemUTC()
}
