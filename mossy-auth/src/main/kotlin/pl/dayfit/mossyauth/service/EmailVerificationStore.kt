package pl.dayfit.mossyauth.service

import org.springframework.data.redis.core.PartialUpdate
import org.springframework.data.redis.core.RedisKeyValueTemplate
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.configuration.EmailVerificationProperties
import pl.dayfit.mossyauth.exception.InvalidVerificationException
import pl.dayfit.mossyauth.exception.VerificationAttemptsExceededException
import pl.dayfit.mossyauth.exception.VerificationExpiredException
import pl.dayfit.mossyauth.exception.VerificationResendLimitedException
import pl.dayfit.mossyauth.model.redis.EmailVerificationRequest
import pl.dayfit.mossyauth.model.redis.VerificationDeliveryState
import pl.dayfit.mossyauth.repository.redis.EmailVerificationRepository
import pl.dayfit.mossyauth.repository.redis.VerificationDeliveryStateRepository
import java.time.Clock
import java.time.Duration
import java.util.UUID

/** Account mutations and attempt counters run under the caller's PostgreSQL user-row lock. */
@Service
class EmailVerificationStore(
    private val repository: EmailVerificationRepository,
    private val deliveryStateRepository: VerificationDeliveryStateRepository,
    private val redisKeyValueTemplate: RedisKeyValueTemplate,
    private val redisTemplate: RedisTemplate<String, Boolean>,
    private val properties: EmailVerificationProperties,
    private val clock: Clock
) {
    fun get(id: UUID): EmailVerificationRequest {
        return repository.findById(id)
            .orElseThrow { expired() }
    }

    fun requireCurrent(record: EmailVerificationRequest) {
        val current = deliveryStateRepository.findById(record.userId)
            .orElseThrow { expired() }

        if (current.verificationId != record.id) {
            throw expired()
        }
    }

    fun create(record: EmailVerificationRequest): Boolean {
        val now = clock.instant()
        val previous = deliveryStateRepository.findById(record.userId).orElse(null)
        val sameWindow = previous != null && now < previous.windowStartedAt.plus(Duration.ofHours(1))
        var availableAt = previous?.lastSentAt?.plus(properties.resendCooldown) ?: now

        if (sameWindow && previous.sendCount >= properties.maxSendsPerHour) {
            availableAt = maxOf(availableAt, previous.windowStartedAt.plus(Duration.ofHours(1)))
        }
        if (now < availableAt) {
            throw VerificationResendLimitedException(
                maxOf(1L, (Duration.between(now, availableAt).toMillis() + 999) / 1000)
            )
        }

        val reservation = "EmailVerificationId:${record.id}"
        val reserved = redisTemplate.opsForValue()
            .setIfAbsent(reservation, true, properties.retention) == true

        if (!reserved || repository.existsById(record.id)) {
            return false
        }

        val windowStartedAt = if (sameWindow) previous.windowStartedAt else now
        val sendCount = if (sameWindow) previous.sendCount + 1 else 1

        if (sendCount >= properties.maxSendsPerHour) {
            record.resendAvailableAt = maxOf(
                record.resendAvailableAt,
                windowStartedAt.plus(Duration.ofHours(1))
            )
        }

        record.timeToLive = properties.retention.seconds
        repository.save(record)
        deliveryStateRepository.save(
            VerificationDeliveryState(
                userId = record.userId,
                verificationId = record.id,
                lastSentAt = now,
                windowStartedAt = windowStartedAt,
                sendCount = sendCount,
                timeToLive = properties.retention.seconds
            )
        )
        return true
    }

    fun validate(
        record: EmailVerificationRequest,
        correct: Boolean,
        code: Boolean,
        alreadyEnabled: Boolean
    ) {
        requireCurrent(record)

        if (clock.instant() >= record.expiresAt) {
            throw expired()
        }
        if (code && !alreadyEnabled && record.failedCodeAttempts >= properties.maxCodeAttempts) {
            exhausted(record)
        }
        if (!correct) {
            if (code) {
                record.failedCodeAttempts++
                // Redis attempts survive the PostgreSQL rollback on a 4xx response.
                redisKeyValueTemplate.update(
                    PartialUpdate(record.id, EmailVerificationRequest::class.java)
                        .set("failedCodeAttempts", record.failedCodeAttempts)
                )

                if (record.failedCodeAttempts >= properties.maxCodeAttempts) {
                    exhausted(record)
                }
            }
            throw InvalidVerificationException()
        }
    }

    fun complete(record: EmailVerificationRequest) {
        redisKeyValueTemplate.update(
            PartialUpdate(record.id, EmailVerificationRequest::class.java)
                .set("completed", true)
        )
    }

    private fun exhausted(record: EmailVerificationRequest): Nothing {
        throw VerificationAttemptsExceededException(
            maxOf(1L, (Duration.between(clock.instant(), record.expiresAt).toMillis() + 999) / 1000)
        )
    }

    private fun expired(): VerificationExpiredException {
        return VerificationExpiredException()
    }
}
