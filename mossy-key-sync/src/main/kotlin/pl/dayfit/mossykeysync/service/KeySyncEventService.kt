package pl.dayfit.mossykeysync.service

import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.context.event.EventListener
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossykeysync.event.KeySyncEvent
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.collections.forEach

@Service
class KeySyncEventService(
    private val asyncRabbitTemplate: AsyncRabbitTemplate,
) {
    private val sseEmitters = ConcurrentHashMap<UUID, MutableList<SseEmitter>>()
    private val logger = LoggerFactory.getLogger(KeySyncEventService::class.java)

    @RabbitListener(queues = ["#{replicaQueue.name}"])
    fun handleKeySyncEvent(event: KeySyncEvent) {
        sseEmitters[event.receiverId]?.forEach { emitter -> runCatching {
            emitter.send(event, MediaType.APPLICATION_JSON)

            if (event.throwable == null) {
                emitter.complete()
                return@runCatching
            }

            emitter.completeWithError(
                event.throwable
            )
        }.onFailure { ex ->
            logger.debug("Exception during sending message through emitter: " + ex.message, ex)
        }}
    }

    fun handleKeySyncEventSubscription(deviceId: UUID): SseEmitter {
        val sseEmitter = SseEmitter(0L)
        sseEmitters.getOrPut(deviceId) { mutableListOf() }.add(sseEmitter)

        sseEmitter.onTimeout { sseEmitters[deviceId]?.remove(sseEmitter) }
        sseEmitter.onError { sseEmitters[deviceId]?.remove(sseEmitter) }
        sseEmitter.onCompletion { sseEmitters[deviceId]?.remove(sseEmitter) }

        return sseEmitter
    }

    @EventListener
    fun handleDeviceEnrolledEvent(event: KeySyncEvent) {
        asyncRabbitTemplate.convertAndSend(
            "key-sync.replica.fanout",
            "",
            event,
        )
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    fun sendHeartbeat() {
        sseEmitters.values.forEach { emitters ->
            emitters.toList().forEach { emitter ->
                try {
                    emitter.send(SseEmitter.event().comment("heartbeat"))
                } catch (e: IOException) {
                    emitters.remove(emitter)
                    logger.debug("Heartbeat connection closed", e)
                } catch (e: IllegalStateException) {
                    emitters.remove(emitter)
                    logger.debug("Heartbeat emitter unavailable", e)
                }
            }
        }
    }
}
