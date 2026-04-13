package messaging.request

import java.util.UUID

data class ExtractCiphertextRequestDto(
    val passwordId: UUID,
    val vaultId: UUID
)
