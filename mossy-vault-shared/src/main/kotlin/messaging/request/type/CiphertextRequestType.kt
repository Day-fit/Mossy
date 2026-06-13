package messaging.request.type

import type.MessageType
import java.util.UUID

data class CiphertextRequestType(
    val passwordId: UUID,
    override val type: MessageType = MessageType.CIPHERTEXT_RETRIEVAL
) : VaultRequestType()