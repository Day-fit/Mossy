package messaging.response.type

import type.MessageType
import java.util.UUID

data class GetTagsResponseType(
    val tags: List<Tag>,
    override val type: MessageType = MessageType.GET_TAGS
) : VaultResponseType() {
    data class Tag(
        val tagId: UUID,
        val tagName: String,
        val color: String
    )
}