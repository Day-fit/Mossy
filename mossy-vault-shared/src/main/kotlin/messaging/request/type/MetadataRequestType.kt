package messaging.request.type

import type.MessageType

class MetadataRequestType(
    override val type: MessageType = MessageType.METADATA_RETRIEVAL
): VaultRequestType()
