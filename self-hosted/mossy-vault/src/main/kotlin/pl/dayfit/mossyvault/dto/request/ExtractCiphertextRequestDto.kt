package pl.dayfit.mossyvault.dto.request

import java.util.UUID

data class ExtractCiphertextRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)