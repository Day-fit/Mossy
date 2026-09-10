package pl.dayfit.mossymailer.configuration

import org.springframework.amqp.core.AcknowledgeMode
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.QueueBuilder
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory
import org.springframework.amqp.rabbit.connection.ConnectionFactory
import org.springframework.boot.amqp.autoconfigure.SimpleRabbitListenerContainerFactoryConfigurer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitMqConfiguration {
    @Bean
    fun emailQueue(): Queue = QueueBuilder.durable("mossy.email.queue")
        .deadLetterExchange("")
        .deadLetterRoutingKey("mossy.email.retry.queue")
        .build()

    @Bean
    fun emailRetryQueue(): Queue = QueueBuilder.durable("mossy.email.retry.queue")
        .ttl(30_000)
        .deadLetterExchange("")
        .deadLetterRoutingKey("mossy.email.queue")
        .build()

    @Bean
    fun rabbitListenerContainerFactory(
        configurer: SimpleRabbitListenerContainerFactoryConfigurer,
        connectionFactory: ConnectionFactory
    ): SimpleRabbitListenerContainerFactory {
        val containerFactory = SimpleRabbitListenerContainerFactory()
        configurer.configure(containerFactory, connectionFactory)
        containerFactory.setBatchListener(true)
        containerFactory.setConsumerBatchEnabled(true)
        containerFactory.setBatchSize(100)
        containerFactory.setAcknowledgeMode(AcknowledgeMode.MANUAL)

        return containerFactory
    }
}
