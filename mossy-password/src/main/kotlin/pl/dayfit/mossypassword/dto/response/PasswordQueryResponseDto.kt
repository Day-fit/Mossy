package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class PasswordQueryResponseDto(
    val passwordIds: List<UUID>,
    val domain: String,
    val vaultId: UUID
)
