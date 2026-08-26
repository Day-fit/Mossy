package pl.dayfit.mossydevicetrustshared.dto.response

import java.time.Instant
import java.util.UUID

data class GenerateChallengeResponseDto(
    val nonce: String,
    val expiresAt: Instant,
    val challengeId: UUID
)
