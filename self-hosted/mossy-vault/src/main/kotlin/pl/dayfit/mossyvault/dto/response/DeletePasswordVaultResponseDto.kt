package pl.dayfit.mossyvault.dto.response

import java.util.UUID

data class DeletePasswordVaultResponseDto(
    val domain: String,
    val passwordId: UUID
)