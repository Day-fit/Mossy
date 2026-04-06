package pl.dayfit.mossypassword.dto.vault.response

import java.util.UUID

data class SavePasswordResponseDto(
    val passwordId: UUID,
    val domain: String,
    val identifier: String
)
