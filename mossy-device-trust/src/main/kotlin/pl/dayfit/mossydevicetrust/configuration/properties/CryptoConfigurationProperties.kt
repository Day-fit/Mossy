package pl.dayfit.mossydevicetrust.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "mossy.crypto")
class CryptoConfigurationProperties {
    var nonceValidityTime: Duration = Duration.ofMinutes(5)
    var nonceByteSize: Int = 16
}