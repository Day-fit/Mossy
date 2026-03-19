package pl.dayfit.mossypassword.messaging.dto

import java.util.UUID

data class QueryPasswordsByDomainRequestDto(
    val domain: String?,
    val vaultId: UUID
)
