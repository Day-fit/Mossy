package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class VaultRegistrationResponseDto(
    val vaultId: UUID,
    val apiKey: String
)
