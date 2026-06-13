package messaging.response.type

import type.MessageType

class DeleteTagResponseType(
    override val type: MessageType = MessageType.DELETE_TAG
) : VaultResponseType()