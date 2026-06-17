package messaging.request

import java.time.Instant
import java.util.UUID

data class PasswordMetadataDto(
    val passwordId: UUID,
    val identifier: String,
    val domain: String,
    val lastModified: Instant,
    val tags: List<Tag>,
    val hasNote: Boolean,
) {
    data class Tag(val tagId: UUID, val tagName: String, val color: String)
}
