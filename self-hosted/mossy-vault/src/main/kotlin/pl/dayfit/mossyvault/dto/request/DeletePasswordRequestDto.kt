package pl.dayfit.mossyvault.dto.request

import java.util.UUID

class DeletePasswordRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)