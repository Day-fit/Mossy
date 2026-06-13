package messaging.response.type

import type.MessageType
import java.util.UUID

data class CiphertextResponseType(
    val ciphertext: String,
    val passwordId: UUID,
    override val type: MessageType = MessageType.CIPHERTEXT_RETRIEVAL
) : VaultResponseType()