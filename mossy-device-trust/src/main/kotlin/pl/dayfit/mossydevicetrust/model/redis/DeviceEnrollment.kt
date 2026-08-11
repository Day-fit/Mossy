package pl.dayfit.mossydevicetrust.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash

@RedisHash("DeviceEnrollment", timeToLive = 60)
class DeviceEnrollment(
    @Id
    val enrollmentId: String? = null,
    val userAgent: String,
    val remoteAddr: String,
    val publicIdentityKey: ByteArray
)
