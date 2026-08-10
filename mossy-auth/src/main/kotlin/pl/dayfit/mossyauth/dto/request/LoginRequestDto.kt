package pl.dayfit.mossyauth.dto.request

import java.util.UUID

data class LoginRequestDto(
    val identifier: String,
    val password: String,

    //If null, generated access token will be for device enrollment only
    val challengeDto: NonceChallengeDto?,
) {
    data class NonceChallengeDto (
        val deviceId: UUID,
        val challengeId: UUID,
        val signature: String,
    )
}