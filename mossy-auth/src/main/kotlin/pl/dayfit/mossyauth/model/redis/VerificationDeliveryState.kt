package pl.dayfit.mossyauth.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import org.springframework.data.redis.core.TimeToLive
import java.time.Instant
import java.util.UUID

@RedisHash("VerificationDeliveryState")
data class VerificationDeliveryState(
    @Id
    val userId: UUID,
    val verificationId: UUID,
    val lastSentAt: Instant,
    val windowStartedAt: Instant,
    val sendCount: Int,
    @TimeToLive
    var timeToLive: Long = 24 * 60 * 60
)
