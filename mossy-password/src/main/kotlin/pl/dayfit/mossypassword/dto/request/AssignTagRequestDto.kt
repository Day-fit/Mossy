package pl.dayfit.mossypassword.dto.request

import java.util.UUID

data class AssignTagRequestDto(
    val vaultId: UUID,
    val tagId: UUID,
)
