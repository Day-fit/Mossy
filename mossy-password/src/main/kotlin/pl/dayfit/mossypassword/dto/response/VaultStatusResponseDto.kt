package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class VaultStatusResponseDto(
    val vaultId: UUID,
    val vaultName: String,
    val isOnline: Boolean
)
