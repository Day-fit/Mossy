package pl.dayfit.mossykeysync.configuration

import org.springframework.amqp.core.AnonymousQueue
import org.springframework.amqp.core.Binding
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
            "key-sync.replica.fanout",
            replicaQueue.name,
            null
        )
    }

    @Bean
    fun messageConverter(): MessageConverter {
        return JacksonJsonMessageConverter()
    }
}
