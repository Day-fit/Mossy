package pl.dayfit.mossyvault.dto.request

import java.util.UUID

enum class SavePasswordAckStatus {
    ACK,
    NACK
}

data class SavePasswordAckRequestDto(
    val messageId: UUID,
    val status: SavePasswordAckStatus
)
