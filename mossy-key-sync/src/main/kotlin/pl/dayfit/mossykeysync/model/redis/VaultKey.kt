package pl.dayfit.mossykeysync.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import org.springframework.data.redis.core.index.Indexed
import java.util.UUID

@RedisHash(timeToLive = 5 * 60)
class VaultKey (
    @Indexed
    val receiverId: UUID,
    val vaultId: UUID,
    val cipherText: String,
    val senderId: UUID,
    val senderPublicDh: String,
    val code: String,
    @Id
    val id: UUID = UUID.randomUUID(),
)
