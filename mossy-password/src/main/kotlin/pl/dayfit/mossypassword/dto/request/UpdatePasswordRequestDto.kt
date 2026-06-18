package pl.dayfit.mossypassword.dto.request

import java.util.UUID

data class UpdatePasswordRequestDto(
    val passwordId: UUID,
    val identifier: String,
    val address: String,
    val cipherText: String,
    val vaultId: UUID
)
