package pl.dayfit.mossydevicetrustshared.dto.request

import java.util.UUID

data class NonceChallengeRequestDto(
    val challengeId: UUID,
    val signature: String,
    val os: String,
    val remoteAddr: String,
    val deviceId: UUID
)
