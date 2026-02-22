package pl.dayfit.mossyauth.dto.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern

data class RegisterUserRequestDto (
    @Pattern(regexp = "^[a-zA-Z0-9_]*$", message = "Username can only contain letters, numbers and underscores")
    @NotBlank(message = "Username cannot be blank")
    val username: String,
    @Pattern(regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", message = "Invalid email format")
    @NotBlank(message = "Email cannot be blank")
    val email: String,
    @NotBlank(message = "Password cannot be blank")
    val password: String,
)