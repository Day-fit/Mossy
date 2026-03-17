package pl.dayfit.mossyvault.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties
import java.util.UUID

@ConfigurationProperties(prefix = "mossy.vault")
data class VaultConfigurationProperties(
    val id: UUID,
    val secret: String
)
