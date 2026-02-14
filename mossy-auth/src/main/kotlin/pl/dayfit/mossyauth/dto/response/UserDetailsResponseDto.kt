package pl.dayfit.mossyauth.dto.response

import java.util.UUID

data class UserDetailsResponseDto(
    val userId: UUID,
    val username: String,
    val email: String?,
    val grantedAuthorities: List<String>
)
