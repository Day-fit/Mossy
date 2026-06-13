package messaging.request.type

import type.MessageType
import java.util.UUID

data class DeleteTagRequestType(
    val tagId: UUID,
    override val type: MessageType = MessageType.DELETE_TAG
) : VaultRequestType()