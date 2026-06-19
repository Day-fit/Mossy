package messaging.request.type

import type.MessageType
import java.util.UUID

data class UpdatePasswordRequestType(
    val passwordId: UUID,
    val identifier: String,
    val address: String,
    val cipherText: String,
    override val type: MessageType = MessageType.UPDATE_PASSWORD
) : VaultRequestType()
