package pl.dayfit.mossyauth.dto.request

import jakarta.validation.constraints.NotBlank

data class LoginRequestDto(
    @NotBlank
    val identifier: String,
    @NotBlank
    val password: String
)