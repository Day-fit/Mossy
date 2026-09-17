package pl.dayfit.mossyauth.dto.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RecoverVerificationRequestDto(
    @field:NotBlank
    @field:Size(max = 254)
    val identifier: String,
    @field:NotBlank
    @field:Size(max = 1024)
    val password: String
)
