package pl.dayfit.mossyauth.dto.request

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank

data class RegisterUserRequestDto (
    @NotBlank(message = "Username cannot be blank")
    val username: String,
    @Email
    @NotBlank(message = "Email cannot be blank")
    val email: String,
    @NotBlank(message = "Password cannot be blank")
    val password: String,
)