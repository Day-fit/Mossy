package pl.dayfit.mossydevicetrustshared.dto.request

import java.util.UUID

/**
 * Internal auth-to-device-trust request for verifying an existing device challenge.
 */
data class VerifyNonceChallengeRequestDto(
    val userId: UUID,
    val deviceId: UUID,
    val challengeId: UUID,
    val signature: String,
    val userAgent: String,
    val remoteAddr: String,
)
