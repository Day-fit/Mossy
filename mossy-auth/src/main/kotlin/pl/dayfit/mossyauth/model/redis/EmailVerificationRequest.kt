package pl.dayfit.mossyauth.model.redis

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import org.springframework.data.redis.core.TimeToLive
import pl.dayfit.mossyauth.dto.response.EmailVerificationDto
import java.time.Instant
import java.util.UUID

@RedisHash("EmailVerificationRequest")
data class EmailVerificationRequest(
    @Id
    val id: UUID,
    val userId: UUID,
    val email: String,
    val codeHash: String,
    val tokenHash: String,
    val expiresAt: Instant,
    var resendAvailableAt: Instant,
    var failedCodeAttempts: Int = 0,
    var completed: Boolean = false,
    @TimeToLive
    var timeToLive: Long = 24 * 60 * 60
) {
    fun metadata(): EmailVerificationDto {
        return EmailVerificationDto(id, expiresAt, resendAvailableAt)
    }
}
