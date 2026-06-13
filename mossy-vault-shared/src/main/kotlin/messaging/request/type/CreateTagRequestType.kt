package messaging.request.type

import type.MessageType

data class CreateTagRequestType(
    val name: String,
    val color: String,
    override val type: MessageType = MessageType.CREATE_TAG
) : VaultRequestType()