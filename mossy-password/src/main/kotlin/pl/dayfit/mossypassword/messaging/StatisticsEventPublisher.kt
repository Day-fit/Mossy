package pl.dayfit.mossypassword.messaging

import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import java.nio.charset.StandardCharsets
import java.util.Base64

@Component
class StatisticsEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    @Value("\${mossy.statistics.exchange}")
    private val exchangeName: String,
    @Value("\${mossy.statistics.password-events-routing-key}")
    private val passwordEventsRoutingKey: String
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(StatisticsEventPublisher::class.java)

    fun publish(event: PasswordStatisticEvent) {
        runCatching {
            rabbitTemplate.convertAndSend(
                exchangeName,
                passwordEventsRoutingKey,
                toPayload(event)
            )
        }.onFailure {
            logger.warn("Failed to publish password statistics event", it)
        }
    }

    private fun toPayload(event: PasswordStatisticEvent): String {
        val encodedDomain = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(event.domain.toByteArray(StandardCharsets.UTF_8))

        return listOf(
            event.vaultId,
            event.passwordId,
            encodedDomain,
            event.actionType,
            event.eventTimestamp.toEpochMilli()
        ).joinToString("|")
    }
}
