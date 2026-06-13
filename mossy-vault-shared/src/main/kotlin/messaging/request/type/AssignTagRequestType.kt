package messaging.request.type

import type.MessageType
import java.util.UUID

data class AssignTagRequestType(
    val passwordId: UUID,
    val tagId: UUID,
    override val type: MessageType = MessageType.ASSIGN_TAG
) : VaultRequestType()