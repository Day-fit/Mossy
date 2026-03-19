package pl.dayfit.mossypassword.dto.request

import java.util.UUID

data class SavePasswordVaultRequestDto(
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val vaultId: UUID
)
