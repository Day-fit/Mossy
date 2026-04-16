package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class CreateVaultResponseDto(
    val vaultId: UUID,
    val apiKey: String,
    val message: String
)
