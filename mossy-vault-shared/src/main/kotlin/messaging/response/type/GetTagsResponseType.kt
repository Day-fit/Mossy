package messaging.response.type

import java.util.UUID

data class GetTagsResponseType(
    val tags: List<Tag>
) : AbstractVaultResponseType() {
    data class Tag(
        val tagId: UUID,
        val tagName: String,
        val color: String
    )
}