package pl.dayfit.mossykeysync.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.junit.jupiter.params.provider.MethodSource
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.MockedConstruction
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.http.MediaType
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossykeysync.event.KeySyncEvent
import java.io.IOException
import java.util.UUID
import java.util.function.Consumer
import kotlin.test.assertEquals

@ExtendWith(MockitoExtension::class)
class KeySyncEventServiceTest {
    @Mock
    lateinit var asyncRabbitTemplate: AsyncRabbitTemplate

    // Mock connections created by the service so tests can simulate disconnects.
    @Mock
    lateinit var emitterConstruction: MockedConstruction<SseEmitter>

    @InjectMocks
    lateinit var service: KeySyncEventService

    @Test
    fun `local key sync events are published to every replica`() {
        val event = KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.SUCCESS)

        service.handleDeviceEnrolledEvent(event)

        verify(asyncRabbitTemplate).convertAndSend("key-sync.replica.fanout", "", event)
    }

    @Test
    fun `key sync result reaches every subscription for the receiver only`() {
        val first = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val second = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val otherReceiver = service.handleKeySyncEventSubscription(OTHER_RECEIVER_ID)
        val event = KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.SUCCESS)

        service.handleKeySyncEvent(event)

        for (emitter in listOf(first, second)) {
            inOrder(emitter) {
                verify(emitter).send(event, MediaType.APPLICATION_JSON)
                verify(emitter).complete()
            }
            verify(emitter, never()).completeWithError(any())
        }
        verify(otherReceiver, never()).send(any<Any>(), any<MediaType>())
        verify(otherReceiver, never()).complete()
        verify(otherReceiver, never()).completeWithError(any())
    }

    @Test
    fun `failed key sync sends the failure event before completing with the original error`() {
        val emitter = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val failure = IllegalStateException("Invalid sender connected")
        val event = KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.FAILED, failure)

        service.handleKeySyncEvent(event)

        inOrder(emitter) {
            verify(emitter).send(event, MediaType.APPLICATION_JSON)
            verify(emitter).completeWithError(failure)
        }
        verify(emitter, never()).complete()
    }

    @Test
    fun `a failed send does not prevent delivery to another subscription`() {
        val disconnected = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val active = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val event = KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.SUCCESS)
        doThrow(IOException("Connection closed")).whenever(disconnected).send(event, MediaType.APPLICATION_JSON)

        service.handleKeySyncEvent(event)

        verify(active).send(event, MediaType.APPLICATION_JSON)
        verify(active).complete()
    }

    @ParameterizedTest
    @EnumSource(SubscriptionEnd::class)
    fun `ended subscriptions are removed without removing other subscriptions for the device`(end: SubscriptionEnd) {
        val ended = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val active = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val event = KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.SUCCESS)

        when (end) {
            SubscriptionEnd.COMPLETION -> {
                val callback = argumentCaptor<Runnable>()
                verify(ended).onCompletion(callback.capture())
                callback.firstValue.run()
            }
            SubscriptionEnd.TIMEOUT -> {
                val callback = argumentCaptor<Runnable>()
                verify(ended).onTimeout(callback.capture())
                callback.firstValue.run()
            }
            SubscriptionEnd.ERROR -> {
                val callback = argumentCaptor<Consumer<Throwable>>()
                verify(ended).onError(callback.capture())
                callback.firstValue.accept(IOException("Connection closed"))
            }
        }

        service.handleKeySyncEvent(event)

        verify(ended, never()).send(event, MediaType.APPLICATION_JSON)
        verify(active).send(event, MediaType.APPLICATION_JSON)
        verify(active).complete()
    }

    @Test
    fun `heartbeat comments are sent to subscriptions for every device`() {
        val first = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val second = service.handleKeySyncEventSubscription(OTHER_RECEIVER_ID)

        service.sendHeartbeat()

        for (emitter in listOf(first, second)) {
            val heartbeat = argumentCaptor<SseEmitter.SseEventBuilder>()
            verify(emitter).send(heartbeat.capture())
            assertEquals(":heartbeat\n\n", heartbeat.firstValue.build().single().data)
        }
    }

    @ParameterizedTest
    @MethodSource("heartbeatFailures")
    fun `heartbeat removes closed subscriptions and continues sending to active ones`(failure: Exception) {
        val disconnected = service.handleKeySyncEventSubscription(RECEIVER_ID)
        val active = service.handleKeySyncEventSubscription(RECEIVER_ID)
        doThrow(failure).whenever(disconnected).send(any<SseEmitter.SseEventBuilder>())

        service.sendHeartbeat()

        verify(active).send(any<SseEmitter.SseEventBuilder>())

        service.sendHeartbeat()

        verify(disconnected).send(any<SseEmitter.SseEventBuilder>())
        verify(active, times(2)).send(any<SseEmitter.SseEventBuilder>())
    }

    enum class SubscriptionEnd {
        COMPLETION,
        TIMEOUT,
        ERROR,
    }

    private companion object {
        val RECEIVER_ID: UUID = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f0")
        val OTHER_RECEIVER_ID: UUID = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f1")

        @JvmStatic
        fun heartbeatFailures() = listOf(
            IOException("Connection closed"),
            IllegalStateException("Emitter already completed"),
        )
    }
}
