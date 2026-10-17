package pl.dayfit.mossypassword.configuration

import org.springframework.amqp.core.AnonymousQueue
import org.springframework.amqp.core.Binding
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration


@Configuration
class RabbitMQConfiguration {
    @Bean
    fun replicaQueue() = AnonymousQueue()

    @Bean
    fun binding(replicaQueue: AnonymousQueue): Binding {
        return Binding(
            replicaQueue.name,
            Binding.DestinationType.QUEUE,
            "password.replica.exchange",
            replicaQueue.name,
            null
        )
    }

    @Bean
    fun messageConverter(): MessageConverter {
        return JacksonJsonMessageConverter()
    }

    @Bean
    fun asyncRabbitTemplate(rabbitTemplate: RabbitTemplate): AsyncRabbitTemplate {
        return AsyncRabbitTemplate(rabbitTemplate)
    }
}
