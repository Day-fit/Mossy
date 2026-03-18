package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class SavePasswordAcceptedResponseDto(
    val passwordId: UUID,
    val message: String
)
