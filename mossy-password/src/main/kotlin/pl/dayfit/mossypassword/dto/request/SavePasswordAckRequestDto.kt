package pl.dayfit.mossypassword.dto.request

import java.util.UUID

enum class SavePasswordAckStatus {
    ACK,
    NACK
}

data class SavePasswordAckRequestDto(
    val vaultId: UUID,
    val passwordId: UUID,
    val domain: String,
    val identifier: String,
    val status: SavePasswordAckStatus,
    val reason: String? = null
)
