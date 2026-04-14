package pl.dayfit.mossypassword.configuration

import org.springframework.amqp.core.AnonymousQueue
import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.DirectExchange
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration


@Configuration
class RabbitMQConfiguration {
    @Bean
    fun replicaQueue() = AnonymousQueue()

    @Bean
    fun replicaDirectExchange() = DirectExchange("password.replica.exchange")

    @Bean
    fun binding(): Binding {
        val queue = replicaQueue()
        val exchange = replicaDirectExchange()

        return BindingBuilder.bind(queue)
            .to(exchange)
            .with(queue.name)
    }

    @Bean
    fun messageConverter(): MessageConverter {
        return JacksonJsonMessageConverter()
    }
}