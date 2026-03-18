package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class CiphertextResponseDto(
    val passwordId: UUID,
    val ciphertext: String,
    val vaultId: UUID
)
