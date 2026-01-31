package pl.dayfit.mossycore.dto.request

import java.util.UUID

class DeletePasswordRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)