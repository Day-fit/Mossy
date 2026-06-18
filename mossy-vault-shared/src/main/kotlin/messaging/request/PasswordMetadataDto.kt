package messaging.request

import type.PasswordType
import java.time.Instant
import java.util.UUID

data class PasswordMetadataDto(
    val passwordId: UUID,
    val identifier: String,
    val address: String,
    val lastModified: Instant,
    val tags: List<Tag>,
    val hasNote: Boolean,
    val passwordType: PasswordType
) {
    data class Tag(val tagId: UUID, val tagName: String, val color: String)
}
