package pl.dayfit.mossypassword.messaging.dto

import pl.dayfit.mossypassword.type.ActionType
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
