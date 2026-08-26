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
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import pl.dayfit.mossydevicetrust.dto.request.Hashable
import pl.dayfit.mossydevicetrust.model.redis.IdempotencyKey
import pl.dayfit.mossydevicetrust.repository.redis.IdempotencyKeyRepository
import java.util.Optional
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertSame
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class IdempotencyServiceTest {
    @Mock
    private lateinit var repository: IdempotencyKeyRepository

    @Mock
    private lateinit var redisTemplate: RedisTemplate<UUID, Boolean>

    @Mock
    private lateinit var valueOperations: ValueOperations<UUID, Boolean>

    @InjectMocks
    private lateinit var service: IdempotencyService

    @Test
    fun `first request executes operation and stores successful response`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        val operationResponse = TestResponse("created")
        var operationCalls = 0

        whenever(repository.findById(idempotencyKey))
            .thenReturn(Optional.empty())
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true))
            .thenReturn(null)
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
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true)).thenReturn(true)

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
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true)).thenReturn(true)

        assertThrows<AccessDeniedException> {
            service.execute(idempotencyKey, changedRequest) {
                operationCalled = true
                TestResponse("new")
            }
        }

        assertFalse(operationCalled)
        verify(repository, never()).save(any<IdempotencyKey>())
    }

    @Test
    fun `request already in progress does not execute operation`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        var operationCalled = false

        whenever(repository.findById(idempotencyKey)).thenReturn(Optional.empty())
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true))
            .thenReturn(true)

        assertThrows<LockedException> {
            service.execute(idempotencyKey, request) {
                operationCalled = true
                TestResponse("new")
            }
        }

        assertFalse(operationCalled)
        verify(repository, never()).save(any<IdempotencyKey>())
    }

    @Test
    fun `completed request is returned even when progress marker is missing`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        val cachedResponse = TestResponse("cached")
        val cachedEntry = IdempotencyKey(
            idempotencyKey,
            request.hash(),
            HttpStatus.CREATED,
            cachedResponse,
        )

        whenever(repository.findById(idempotencyKey)).thenReturn(Optional.of(cachedEntry))
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true))
            .thenReturn(null)

        val response = service.execute(idempotencyKey, request) {
            TestResponse("new")
        }

        assertEquals(HttpStatus.CREATED, response.statusCode)
        assertSame(cachedResponse, response.body)
        verify(repository, never()).save(any<IdempotencyKey>())
    }

    @Test
    fun `concurrent requests with same key execute operation exactly once`() {
        val idempotencyKey = UUID.randomUUID()
        val request = TestRequest("request")
        val operationStarted = CountDownLatch(1)
        val allowOperationToComplete = CountDownLatch(1)
        val markerPresent = AtomicBoolean(false)
        val storedEntries = ConcurrentHashMap<UUID, IdempotencyKey>()
        val operationCalls = AtomicInteger()
        val executor = Executors.newFixedThreadPool(2)

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.getAndSet(idempotencyKey, true))
            .thenAnswer { markerPresent.getAndSet(true) }
        whenever(repository.findById(idempotencyKey))
            .thenAnswer { Optional.ofNullable(storedEntries[idempotencyKey]) }
        whenever(repository.save(any<IdempotencyKey>()))
            .thenAnswer { invocation ->
                invocation.getArgument<IdempotencyKey>(0).also {
                    storedEntries[it.idempotencyKey] = it
                }
            }

        try {
            val firstRequest = executor.submit<ResponseEntity<TestResponse>> {
                service.execute(idempotencyKey, request) {
                    operationCalls.incrementAndGet()
                    operationStarted.countDown()
                    assertTrue(allowOperationToComplete.await(5, TimeUnit.SECONDS))
                    TestResponse("created")
                }
            }

            assertTrue(
                operationStarted.await(5, TimeUnit.SECONDS),
                "The first request must acquire the key and start the operation",
            )

            val secondRequest = executor.submit<Throwable?> {
                runCatching {
                    service.execute(idempotencyKey, request) {
                        operationCalls.incrementAndGet()
                        TestResponse("duplicate")
                    }
                }.exceptionOrNull()
            }

            assertIs<LockedException>(secondRequest.get(5, TimeUnit.SECONDS))
            allowOperationToComplete.countDown()

            assertEquals("created", firstRequest.get(5, TimeUnit.SECONDS).body?.value)
            assertEquals(1, operationCalls.get())
            assertEquals(1, storedEntries.size)
        } finally {
            allowOperationToComplete.countDown()
            executor.shutdownNow()
        }
    }

    private data class TestRequest(val value: String) : Hashable
    private data class TestResponse(val value: String)
}
