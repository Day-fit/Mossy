package pl.dayfit.mossyvault.dto.request

import java.util.UUID

data class QueryPasswordsByDomainRequestDto(
    val domain: String?,
    val vaultId: UUID
)
