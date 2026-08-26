package pl.dayfit.mossydevicetrust.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import org.springframework.http.HttpStatus
import java.util.UUID

@RedisHash("idempotencyKey", timeToLive = 60)
class IdempotencyKey (
    @Id
    val idempotencyKey: UUID,
    val requestHash: ByteArray,
    val statusCode: HttpStatus,
    val responseDto: Any
)