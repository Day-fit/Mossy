package pl.dayfit.mossypassword.dto.vault.response

import pl.dayfit.mossypassword.dto.vault.request.PasswordMetadataDto

data class PasswordQueryResponseDto(
    val passwords: List<PasswordMetadataDto>,
    val domain: String?,
)
