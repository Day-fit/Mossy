package pl.dayfit.mossyvault.dto.response

import java.util.UUID

data class PasswordQueryResponseDto(
    val passwords: List<PasswordMetadataDto>,
    val domain: String?,
    val vaultId: UUID
)
