package pl.dayfit.mossydevicetrust.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import pl.dayfit.mossydevicetrust.dto.request.Hashable
import pl.dayfit.mossydevicetrust.model.redis.IdempotencyKey
import pl.dayfit.mossydevicetrust.repository.redis.IdempotencyKeyRepository
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame

@ExtendWith(MockitoExtension::class)
class IdempotencyServiceTest {
    @Mock
    private lateinit var repository: IdempotencyKeyRepository

    @InjectMocks
    private lateinit var service: IdempotencyService

    @Test
    fun `cache miss executes operation and stores successful response`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        val operationResponse = TestResponse("created")
        var operationCalls = 0

        whenever(repository.findById(idempotencyKey))
            .thenReturn(Optional.empty())
        whenever(repository.save(any<IdempotencyKey>()))
            .thenAnswer { it.getArgument(0) }

        val response = service.execute(idempotencyKey, request) {
            operationCalls++
            operationResponse
        }

        assertEquals(HttpStatus.OK, response.statusCode)
        assertSame(operationResponse, response.body)
        assertEquals(1, operationCalls)
        verify(repository).save(
            argThat { entry ->
                entry.idempotencyKey == idempotencyKey &&
                    entry.requestHash.contentEquals(request.hash()) &&
                    entry.statusCode == HttpStatus.OK &&
                    entry.responseDto === operationResponse
            }
        )
    }

    @Test
    fun `cache hit with same request returns stored response without executing operation`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        val cachedResponse = TestResponse("cached")
        val cachedEntry = IdempotencyKey(
            idempotencyKey,
            request.hash(),
            HttpStatus.CREATED,
            cachedResponse,
        )
        var operationCalled = false

        whenever(repository.findById(idempotencyKey))
            .thenReturn(Optional.of(cachedEntry))

        val response = service.execute(idempotencyKey, request) {
            operationCalled = true
            TestResponse("new")
        }

        assertEquals(HttpStatus.CREATED, response.statusCode)
        assertSame(cachedResponse, response.body)
        assertFalse(operationCalled)
        verify(repository, never()).save(any<IdempotencyKey>())
    }

    @Test
    fun `reusing key with changed request is rejected without executing operation`() {
        val idempotencyKey = UUID.randomUUID()
        val originalRequest = TestRequest("original")
        val changedRequest = TestRequest("changed")
        val cachedEntry = IdempotencyKey(
            idempotencyKey,
            originalRequest.hash(),
            HttpStatus.OK,
            TestResponse("cached"),
        )
        var operationCalled = false

        whenever(repository.findById(idempotencyKey))
            .thenReturn(Optional.of(cachedEntry))

        assertThrows<AccessDeniedException> {
            service.execute(idempotencyKey, changedRequest) {
                operationCalled = true
                TestResponse("new")
            }
        }

        assertFalse(operationCalled)
        verify(repository, never()).save(any<IdempotencyKey>())
    }

    private data class TestRequest(val value: String) : Hashable
    private data class TestResponse(val value: String)
}
