package pl.dayfit.mossyvault.dto.response

import java.util.UUID

data class SavePasswordResponseDto(
    val passwordId: UUID,
    val domain: String,
    val identifier: String,
    val vaultId: UUID
)
