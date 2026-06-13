package pl.dayfit.mossypassword.dto.request

import java.util.UUID

data class UnassignTagRequestDto(
    val vaultId: UUID,
    val tagId: UUID,
)

