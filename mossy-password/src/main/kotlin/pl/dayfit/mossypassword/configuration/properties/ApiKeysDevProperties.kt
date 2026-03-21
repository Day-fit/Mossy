package pl.dayfit.mossypassword.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Profile
import java.util.UUID

@Profile("dev")
@ConfigurationProperties(prefix = "mossy.dev")
data class ApiKeysDevProperties(
    var ownerId: UUID? = null,
    var vaultId: UUID? = null,
    var apiKey: String? = null,
    var vaultName: String? = null
)
