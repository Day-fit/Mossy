package messaging.request.type

import type.MessageType
import java.util.UUID

data class UnassignTagRequestType(
    val passwordId: UUID,
    val tagId: UUID,
    override val type: MessageType = MessageType.UNASSIGN_TAG
) : VaultRequestType()

