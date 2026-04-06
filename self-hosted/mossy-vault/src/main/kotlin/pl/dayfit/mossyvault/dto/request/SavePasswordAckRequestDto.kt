package pl.dayfit.mossyvault.dto.request

import pl.dayfit.mossyvault.types.AckStatus
import java.util.UUID

data class SavePasswordAckRequestDto(
    val passwordId: UUID?,
    val domain: String,
    val status: AckStatus,
    val reason: String? = null
)
