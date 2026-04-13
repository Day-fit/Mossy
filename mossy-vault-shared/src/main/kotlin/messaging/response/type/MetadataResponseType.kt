package messaging.response.type

import java.time.Instant
import java.util.UUID

data class MetadataResponseType(
    val passwordId: UUID,
    val identifier: String,
    val domain: String,
    val lastModified: Instant
) : AbstractVaultResponseType()