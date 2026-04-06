package pl.dayfit.mossypassword.dto.vault.request

import java.util.UUID

enum class SavePasswordAckStatus {
    ACK,
    NACK
}

data class SavePasswordAckRequestDto(
    val passwordId: UUID?,
    val domain: String,
    val status: SavePasswordAckStatus,
    val reason: String? = null
)
