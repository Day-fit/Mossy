package pl.dayfit.mossykeysync.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import java.util.UUID

@RedisHash(timeToLive = 5 * 60)
class VaultKey (
    @Id
    val receiverId: UUID,
    val vaultId: UUID,
    val cipherText: String,
    val senderId: UUID,
    val senderPublicDh: String,
    val code: String,
)
