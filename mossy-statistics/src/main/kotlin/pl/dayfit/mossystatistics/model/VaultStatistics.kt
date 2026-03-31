package pl.dayfit.mossystatistics.model

import jakarta.persistence.Entity
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
data class VaultStatistics(
    @Id
    val vaultId: UUID,
    val userId: UUID,
    var passwordsCount: Long = 0,
    var lastSeenAt: Instant? = null
)
