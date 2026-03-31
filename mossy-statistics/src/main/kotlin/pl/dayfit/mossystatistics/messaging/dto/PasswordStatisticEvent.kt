package pl.dayfit.mossystatistics.messaging.dto

import pl.dayfit.mossystatistics.type.ActionType
import java.time.Instant
import java.util.UUID

data class PasswordStatisticEvent(
    val actionId: UUID = UUID.randomUUID(),
    val vaultId: UUID,
    val userId: UUID,
    val passwordId: UUID,
    val domain: String,
    val actionType: ActionType,
    val eventTimestamp: Instant = Instant.now()
)
