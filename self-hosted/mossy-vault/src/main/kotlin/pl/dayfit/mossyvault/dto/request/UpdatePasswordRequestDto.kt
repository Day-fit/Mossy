package pl.dayfit.mossyvault.dto.request

import java.util.UUID

data class UpdatePasswordRequestDto(
    val passwordId: UUID,
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val vaultId: UUID
)