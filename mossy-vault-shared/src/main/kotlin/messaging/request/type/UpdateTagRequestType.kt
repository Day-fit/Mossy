package messaging.request.type

import type.MessageType
import java.util.UUID

data class UpdateTagRequestType(
    val tagId: UUID,
    val name: String?,
    val color: String?,
    override val type: MessageType = MessageType.UPDATE_TAG
) : VaultRequestType()