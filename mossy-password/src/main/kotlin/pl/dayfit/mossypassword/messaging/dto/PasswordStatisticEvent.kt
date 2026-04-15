package pl.dayfit.mossypassword.messaging.dto

import type.ActionType
import java.time.Instant
import java.util.UUID

data class PasswordStatisticEvent(
    val vaultId: UUID,
    val userId: UUID,
    val passwordId: UUID,
    val domain: String,
    val actionType: ActionType,
    val actionId: UUID = UUID.randomUUID(),
    val eventTimestamp: Instant = Instant.now()
)
