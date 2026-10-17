package pl.dayfit.mossydevicetrust.service

import org.slf4j.LoggerFactory
import org.springframework.amqp.core.FanoutExchange
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.context.event.EventListener
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossydevicetrust.messaging.DeviceEnrolledEvent
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Service
@EnableScheduling
class DeviceEventService(
    private val deviceEnrollmentEventsFanoutQueue: FanoutExchange,
    private val rabbitTemplate: RabbitTemplate,
) {
    private val sseEmitters = ConcurrentHashMap<UUID, MutableList<SseEmitter>>()
    private val logger = LoggerFactory.getLogger(DeviceEventService::class.java)

    @RabbitListener(queues = ["#{deviceEnrollmentEventsQueue.name}"])
    fun handleDeviceEnrollmentEvent(event: DeviceEnrolledEvent) {
        sseEmitters[event.userId]?.forEach {
            emitter -> runCatching {
                emitter.send(event.newEnrollment, MediaType.APPLICATION_JSON)
            }.onFailure { ex ->
                logger.debug("Exception during sending message through emitter: " + ex.message, ex)
            }
        }
    }

    fun subscribeNewEnrollmentEvent(userId: UUID): SseEmitter {
        val sseEmitter = SseEmitter(0L)

        sseEmitter.onTimeout { sseEmitters[userId]?.remove(sseEmitter) }
        sseEmitter.onError { sseEmitters[userId]?.remove(sseEmitter) }
        sseEmitter.onCompletion { sseEmitters[userId]?.remove(sseEmitter) }

        sseEmitters.getOrPut(userId) { mutableListOf() }.add(sseEmitter)

        return sseEmitter
    }

    @EventListener
    fun handleDeviceEnrolledEvent(event: DeviceEnrolledEvent) {
        rabbitTemplate.convertAndSend(
            deviceEnrollmentEventsFanoutQueue.name,
            "",
            event,
        )
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    fun sendHeartbeat() {
        sseEmitters.values.forEach { emitters ->
            emitters.forEach { emitter ->
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