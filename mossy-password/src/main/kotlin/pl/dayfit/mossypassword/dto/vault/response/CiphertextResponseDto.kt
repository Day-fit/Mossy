package pl.dayfit.mossypassword.dto.vault.response

import java.util.UUID

data class CiphertextResponseDto(
    val passwordId: UUID,
    val ciphertext: String,
)
