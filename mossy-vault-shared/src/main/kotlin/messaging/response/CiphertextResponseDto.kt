package messaging.response

import java.util.UUID

data class CiphertextResponseDto(
    val passwordId: UUID,
    val ciphertext: String,
)
