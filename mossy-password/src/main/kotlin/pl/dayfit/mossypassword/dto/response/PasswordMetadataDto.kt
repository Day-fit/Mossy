package pl.dayfit.mossypassword.dto.response

import java.time.Instant
import java.util.UUID

data class PasswordMetadataDto(
    val passwordId: UUID,
    val identifier: String,
    val domain: String,
    val lastModified: Instant
)
