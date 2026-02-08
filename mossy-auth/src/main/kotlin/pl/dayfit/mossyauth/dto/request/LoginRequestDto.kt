package pl.dayfit.mossyauth.dto.request

data class LoginRequestDto(
    val identifier: String,
    val password: String
)