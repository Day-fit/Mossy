package pl.dayfit.mossydevicetrust.configuration

import org.springframework.amqp.core.AnonymousQueue
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.FanoutExchange
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitMQConfiguration {
    @Bean
    fun deviceEnrollmentEventsQueue() = AnonymousQueue()
    @Bean
    fun deviceEnrollmentEventsFanoutQueue() = FanoutExchange("mossy.device-enrollment-events.fanout")
    @Bean
    fun deviceEnrollmentEventsBinding(
        deviceEnrollmentEventsQueue: AnonymousQueue,
        deviceEnrollmentEventsFanoutQueue: FanoutExchange
    ) = BindingBuilder.bind(deviceEnrollmentEventsQueue)
        .to(deviceEnrollmentEventsFanoutQueue)

    @Bean
    fun messageConverter(): MessageConverter {
        return JacksonJsonMessageConverter()
    }
}