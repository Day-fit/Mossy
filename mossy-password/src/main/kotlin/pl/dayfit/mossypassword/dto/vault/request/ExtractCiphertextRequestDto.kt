package pl.dayfit.mossypassword.dto.vault.request

import java.util.UUID

data class ExtractCiphertextRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)
