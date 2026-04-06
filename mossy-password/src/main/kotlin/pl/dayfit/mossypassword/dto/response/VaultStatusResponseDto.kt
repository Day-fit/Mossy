package pl.dayfit.mossypassword.dto.response

import java.time.Instant
import java.util.UUID

data class VaultStatusResponseDto(
    val vaultId: UUID,
    val vaultName: String,
    val isOnline: Boolean,
    val lastSeenAt: Instant?,
    val passwordCount: Int
)
