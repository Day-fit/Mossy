package messaging.response.type

import type.MessageType
import java.util.UUID

class CreateTagResponseType(
    val tagId: UUID? = null,
    override val type: MessageType = MessageType.CREATE_TAG
) : VaultResponseType()