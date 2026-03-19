package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class PasswordQueryResponseDto(
    val passwords: List<PasswordMetadataDto>,
    val domain: String?,
    val vaultId: UUID
)
