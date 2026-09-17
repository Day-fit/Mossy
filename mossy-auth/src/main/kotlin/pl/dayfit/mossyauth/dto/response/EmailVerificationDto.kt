package pl.dayfit.mossyauth.dto.response

import java.time.Instant
import java.util.UUID

data class EmailVerificationDto(
    val verificationId: UUID,
    val expiresAt: Instant,
    val resendAvailableAt: Instant
)
