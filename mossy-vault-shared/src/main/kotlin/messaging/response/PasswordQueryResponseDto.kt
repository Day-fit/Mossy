package messaging.response

import messaging.request.PasswordMetadataDto

data class PasswordQueryResponseDto(
    val passwords: List<PasswordMetadataDto>,
    val domain: String?,
)
