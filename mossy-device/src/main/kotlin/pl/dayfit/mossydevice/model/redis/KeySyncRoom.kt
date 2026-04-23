package pl.dayfit.mossydevice.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import org.springframework.data.redis.core.index.Indexed
import java.util.UUID

/**
 * Represents a synchronized room configuration for a key synchronization process.
 *
 * This entity is stored in a Redis database with a specified time-to-live (TTL). Each room
 * is uniquely identifiable by its `roomId`, which is further associated with a user and
 * their pair of device IDs.
 *
 * @property roomId The unique identifier for the synchronization room.
 * @property userId The unique identifier of the user associated with this synchronization room.
 * @property receiverId The unique identifier of the device that will receive the synchronization data.
 * @property receiverPresent A flag indicating if the receiver device is present in the synchronization process.
 * @property senderPresent A flag indicating if the sender device is present
 * in the synchronization process. Either of the device IDs may be null if not applicable.
 */
@RedisHash(timeToLive = 15 * 60)
data class KeySyncRoom(
    @Id
    var roomId: String?,
    val code: String,
    @Indexed
    val userId: UUID,
    val receiverId: UUID,
    var receiverDh: String? = null,
    var senderId: UUID? = null,
    var senderDh: String? = null,
    var receiverPresent: Boolean = false,
    var senderPresent: Boolean = false
)
