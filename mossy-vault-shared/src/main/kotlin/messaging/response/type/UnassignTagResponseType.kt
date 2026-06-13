package messaging.response.type

import type.MessageType

class UnassignTagResponseType(
    override val type: MessageType = MessageType.UNASSIGN_TAG
) : VaultResponseType()

