package messaging.response

import java.util.UUID

data class SavePasswordResponseDto(
    val passwordId: UUID,
    val domain: String,
    val identifier: String
)
