package pl.dayfit.mossyauth.dto.request

import java.util.UUID

data class LoginRequestDto(
    val identifier: String,
    val password: String,

    val challengeId: UUID,
    val signature: String,
)