package messaging.request.type

import type.MessageType
import java.util.UUID

data class DeletePasswordRequestType(
    val passwordId: UUID,
    override val type: MessageType = MessageType.DELETE_PASSWORD
) : VaultRequestType()