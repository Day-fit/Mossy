package messaging.response.type

import type.MessageType

data class AssignTagResponseType(
    override val type: MessageType = MessageType.ASSIGN_TAG
) : VaultResponseType()