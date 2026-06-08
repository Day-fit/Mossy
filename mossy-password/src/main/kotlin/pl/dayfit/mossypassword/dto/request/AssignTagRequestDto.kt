package pl.dayfit.mossypassword.dto.request

import jakarta.validation.constraints.Pattern
import java.util.UUID

data class AddTagRequestDto(
    val passwordId: UUID,
    val vaultId: UUID,
    val tagName: String,
    @field:Pattern("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
    val color: String
)
