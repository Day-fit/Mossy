package messaging.response.type

import messaging.request.PasswordMetadataDto
import type.MessageType

data class MetadataResponseType(
    val metadata: List<PasswordMetadataDto>,
    override val type: MessageType = MessageType.METADATA_RETRIEVAL
) : VaultResponseType()