package pl.dayfit.mossystatistics.messaging.dto

import java.time.Instant
import java.util.UUID

data class PasswordStatisticEvent(
    val vaultId: UUID,
    val passwordId: UUID,
    val domain: String,
    val actionType: String,
    val eventTimestamp: Instant = Instant.now()
)
