package messaging.response.type

import type.MessageType

data class UpdateTagResponseType(
    override val type: MessageType = MessageType.UPDATE_TAG
) : VaultResponseType()