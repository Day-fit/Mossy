package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class SavePasswordResponseDto(
    val vaultId: UUID,
    val passwordId: UUID,
    val domain: String,
    val identifier: String
)
