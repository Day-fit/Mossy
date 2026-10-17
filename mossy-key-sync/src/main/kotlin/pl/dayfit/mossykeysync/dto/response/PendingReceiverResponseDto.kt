package pl.dayfit.mossykeysync.dto.response

import java.util.UUID

data class PendingReceiverResponseDto(
    val code: String,
    val receiverId: UUID,
    val vaultId: UUID,
    val publicDh: Map<String, Any>,
    val signature: String,
)
