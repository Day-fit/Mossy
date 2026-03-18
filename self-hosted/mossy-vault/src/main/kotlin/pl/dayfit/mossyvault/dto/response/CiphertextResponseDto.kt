package pl.dayfit.mossyvault.dto.response

import java.util.UUID

data class CiphertextResponseDto(
    val passwordId: UUID,
    val ciphertext: String,
    val vaultId: UUID
)
