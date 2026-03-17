package pl.dayfit.mossystatistics.dto.client

import java.util.UUID

data class VaultStatusClientDto(
    val vaultId: UUID,
    val vaultName: String,
    val isOnline: Boolean
)
