package pl.dayfit.mossydevicetrust.service

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import pl.dayfit.mossydevicetrust.dto.request.Hashable
import pl.dayfit.mossydevicetrust.model.redis.IdempotencyKey
import pl.dayfit.mossydevicetrust.repository.redis.IdempotencyKeyRepository
import java.util.UUID

@Service
class IdempotencyService(
    private val repository: IdempotencyKeyRepository,
) {
    @Suppress("UNCHECKED_CAST")
    fun <R: Any> execute(
        idempotencyKey: UUID,
        requestDto: Hashable,
        operation: () -> R
    ): ResponseEntity<R> {
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
    }
}