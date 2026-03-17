package pl.dayfit.mossystatistics.configuration

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.DirectExchange
import org.springframework.amqp.core.Queue
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitMqConfiguration(
    @Value("\${mossy.statistics.password-events-queue}")
    private val passwordEventsQueueName: String
) {
    @Bean
    fun passwordEventsQueue(): Queue {
        return Queue(passwordEventsQueueName, true)
    }

    @Bean
    fun statisticsExchange(): DirectExchange {
        return DirectExchange(STATISTICS_EXCHANGE, true, false)
    }

    @Bean
    fun passwordEventsBinding(
        passwordEventsQueue: Queue,
        statisticsExchange: DirectExchange
    ): Binding {
        return BindingBuilder.bind(passwordEventsQueue)
            .to(statisticsExchange)
            .with(PASSWORD_EVENTS_ROUTING_KEY)
    }

    companion object {
        private const val STATISTICS_EXCHANGE = "direct.statistics.exchange"
        private const val PASSWORD_EVENTS_ROUTING_KEY = "statistics.password.event"
    }
}
