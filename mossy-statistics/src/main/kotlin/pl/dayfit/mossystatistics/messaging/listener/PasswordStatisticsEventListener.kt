package pl.dayfit.mossystatistics.messaging.listener

import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import pl.dayfit.mossystatistics.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossystatistics.service.StatisticsAggregationService
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.Base64
import java.util.UUID

@Component
class PasswordStatisticsEventListener(
    private val statisticsAggregationService: StatisticsAggregationService
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(PasswordStatisticsEventListener::class.java)

    @RabbitListener(queues = ["\${mossy.statistics.password-events-queue}"])
    fun listen(rawEvent: String) {
        try {
            val event = parseEvent(rawEvent)
            statisticsAggregationService.consume(event)
        } catch (exception: Exception) {
            logger.warn("Failed to parse password statistics event", exception)
        }
    }

    private fun parseEvent(rawEvent: String): PasswordStatisticEvent {
        val parts = rawEvent.split('|')
        require(parts.size == 5)

        val domain = String(Base64.getUrlDecoder().decode(parts[2]), StandardCharsets.UTF_8)

        return PasswordStatisticEvent(
            vaultId = UUID.fromString(parts[0]),
            passwordId = UUID.fromString(parts[1]),
            domain = domain,
            actionType = parts[3],
            eventTimestamp = Instant.ofEpochMilli(parts[4].toLong())
        )
    }
}
