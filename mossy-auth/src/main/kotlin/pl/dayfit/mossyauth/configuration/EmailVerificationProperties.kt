package pl.dayfit.mossyauth.configuration

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties("mossy.auth.email-verification")
class EmailVerificationProperties {
    var validity: Duration = Duration.ofMinutes(15)
    var retention: Duration = Duration.ofHours(24)
    var resendCooldown: Duration = Duration.ofSeconds(60)
    var maxCodeAttempts: Int = 5
    var maxSendsPerHour: Int = 5
    var frontendBaseUrl: String = "https://mossy.dayfit.pl"
}
