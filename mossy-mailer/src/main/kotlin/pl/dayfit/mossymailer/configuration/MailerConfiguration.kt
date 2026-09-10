package pl.dayfit.mossymailer.configuration

import com.resend.Resend
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import pl.dayfit.mossymailer.configuration.properties.ResendConfigurationProperties

@Configuration
@EnableConfigurationProperties(ResendConfigurationProperties::class)
class MailerConfiguration {
    @Bean
    fun resend(resendConfigurationProperties: ResendConfigurationProperties): Resend {
        val resend = Resend(resendConfigurationProperties.apiKey)

        return resend
    }
}