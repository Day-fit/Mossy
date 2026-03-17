package pl.dayfit.mossystatistics.model

import jakarta.persistence.Entity
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
data class VaultStatistics(
    @Id
    val vaultId: UUID,
    var passwordsCount: Long = 0,
    var lastUpdatedAt: Instant = Instant.now()
)
