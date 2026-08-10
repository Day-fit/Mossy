package pl.dayfit.mossydevicetrust.model.redis

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash

@RedisHash("DeviceEnrollment", timeToLive = 60)
class DeviceEnrollment(
    @Id
    val enrollmentId: String? = null,
    val osName: String,
    val remoteAddr: String,
    val publicIdentityKey: OctetKeyPair
)