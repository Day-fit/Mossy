package pl.dayfit.mossyauth.dto.request

import java.util.UUID

data class ResendVerificationRequestDto(
    val verificationId: UUID
)
