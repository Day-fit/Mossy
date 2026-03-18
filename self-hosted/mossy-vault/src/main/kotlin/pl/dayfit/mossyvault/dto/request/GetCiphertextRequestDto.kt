package pl.dayfit.mossyvault.dto.request

import java.util.UUID

data class GetCiphertextRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)
