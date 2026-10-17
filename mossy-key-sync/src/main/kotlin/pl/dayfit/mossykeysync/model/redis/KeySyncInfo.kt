package pl.dayfit.mossykeysync.model.redis

import java.util.UUID

data class KeySyncInfo(
    val userId: UUID,
    val vaultId: UUID,
    val receiverId: UUID,
    val publicDh: Map<String, Any>,
    val signature: String,
)
