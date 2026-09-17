package pl.dayfit.mossyauth.dto.request

import jakarta.validation.constraints.Pattern
import java.util.UUID

data class ConfirmEmailRequestDto(
    val verificationId: UUID,
    @field:Pattern(regexp = "[0-9]{6}", message = "Code must contain six digits")
    val code: String? = null,
    @field:Pattern(regexp = "[A-Za-z0-9_-]{43}", message = "Invalid confirmation token format")
    val token: String? = null
)
