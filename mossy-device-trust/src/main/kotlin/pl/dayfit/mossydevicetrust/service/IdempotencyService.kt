package pl.dayfit.mossydevicetrust.service

import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.stereotype.Service
import pl.dayfit.mossydevicetrust.dto.request.Hashable
import pl.dayfit.mossydevicetrust.model.redis.IdempotencyKey
import pl.dayfit.mossydevicetrust.repository.redis.IdempotencyKeyRepository
import java.time.Duration
import java.util.UUID

private val IN_PROGRESS_TTL: Duration = Duration.ofSeconds(30)

@Service
class IdempotencyService(
    private val repository: IdempotencyKeyRepository,
    private val redisTemplate: RedisTemplate<UUID, Boolean>,
) {
    @Suppress("UNCHECKED_CAST")
    fun <R : Any> execute(
        idempotencyKey: UUID,
        requestDto: Hashable,
        operation: () -> R
    ): ResponseEntity<R> {
        val isInProgress = redisTemplate.opsForValue()
            .setIfAbsent(idempotencyKey, true, IN_PROGRESS_TTL) != true

        if (isInProgress) {
            val result = repository.findById(idempotencyKey)
                .orElseThrow { LockedException("One request is already in progress") }

            val sameHash = requestDto.hash().contentEquals(
                result.requestHash
            )

            if (!sameHash) {
                throw AccessDeniedException("Request cannot be changed when using same idempotency key")
            }

            return ResponseEntity(result.responseDto as R, result.statusCode)
        }

        try {
            val optionalResult = repository.findById(idempotencyKey)

            if (!optionalResult.isPresent) {
                val response = operation()

                val entry = IdempotencyKey(
                    idempotencyKey,
                    requestDto.hash(),
                    HttpStatus.OK,
                    response
                )

                repository.save(entry)

                return ResponseEntity.ok(response)
            }

            val result = optionalResult.get()
            val sameHash = requestDto.hash().contentEquals(
                result.requestHash
            )

            if (!sameHash) {
                throw AccessDeniedException("Request cannot be changed when using same idempotency key")
            }

            return ResponseEntity(result.responseDto as R, result.statusCode)
        } finally {
            redisTemplate.opsForValue()
                .getAndDelete(idempotencyKey)
        }
    }
}
