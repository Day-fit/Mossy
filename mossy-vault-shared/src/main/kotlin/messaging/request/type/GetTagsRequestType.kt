package messaging.request.type

import type.MessageType

class GetTagsRequestType(
    override val type: MessageType = MessageType.GET_TAGS
) : VaultRequestType()
