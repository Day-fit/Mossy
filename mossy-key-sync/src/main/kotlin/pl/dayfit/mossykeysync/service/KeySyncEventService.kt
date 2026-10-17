package pl.dayfit.mossykeysync.service

import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.context.event.EventListener
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossykeysync.event.KeySyncEvent
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

@Service
@EnableScheduling
class KeySyncEventService(
    private val rabbitTemplate: RabbitTemplate,
) {
    private val sseEmitters = ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>>()
    private val logger = LoggerFactory.getLogger(KeySyncEventService::class.java)

    @RabbitListener(queues = ["#{replicaQueue.name}"])
    fun handleKeySyncEvent(event: KeySyncEvent) {
        sseEmitters[event.receiverId]?.forEach { emitter ->
            try {
                emitter.send(event, MediaType.APPLICATION_JSON)
                if (event.throwable == null) {
                    emitter.complete()
                } else {
                    emitter.completeWithError(event.throwable)
                }
            } catch (_: IOException) {
                logger.debug("Receiver {} disconnected during result delivery", event.receiverId)
            } catch (_: IllegalStateException) {
                logger.debug("Receiver {} stream already closed during receiving event", event.receiverId)
            } finally {
                removeSubscription(event.receiverId, emitter)
            }
        }
    }

    fun handleKeySyncEventSubscription(deviceId: UUID): SseEmitter {
        val sseEmitter = SseEmitter(0L)
        sseEmitter.onTimeout { removeSubscription(deviceId, sseEmitter) }
        sseEmitter.onError { removeSubscription(deviceId, sseEmitter) }
        sseEmitter.onCompletion { removeSubscription(deviceId, sseEmitter) }
        sseEmitters.compute(deviceId) { _, emitters ->
            (emitters ?: CopyOnWriteArrayList()).apply { add(sseEmitter) }
        }

        try {
            sseEmitter.send(SseEmitter.event().comment("connected"))
        } catch (ex: Exception) {
            removeSubscription(deviceId, sseEmitter)
            throw ex
        }

        return sseEmitter
    }

    @EventListener
    fun publishKeySyncEvent(event: KeySyncEvent) {
        rabbitTemplate.convertAndSend(
            "key-sync.replica.fanout",
            "",
            event,
        )
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    fun sendHeartbeat() {
        sseEmitters.forEach { (deviceId, emitters) ->
            emitters.forEach { emitter ->
                try {
                    emitter.send(SseEmitter.event().comment("heartbeat"))
                } catch (_: IOException) {
                    removeSubscription(deviceId, emitter)
                    logger.debug("Receiver {} disconnected during heartbeat", deviceId)
                } catch (_: IllegalStateException) {
                    removeSubscription(deviceId, emitter)
                    logger.debug("Receiver {} heartbeat stream already closed", deviceId)
                }
            }
        }
    }

    private fun removeSubscription(deviceId: UUID, emitter: SseEmitter) {
        sseEmitters.computeIfPresent(deviceId) { _, emitters ->
            emitters.remove(emitter)
            emitters.takeIf { it.isNotEmpty() }
        }
    }
}
