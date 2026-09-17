package pl.dayfit.mossymailer.configuration

import org.springframework.amqp.core.AcknowledgeMode
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory
import org.springframework.amqp.rabbit.connection.ConnectionFactory
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.boot.amqp.autoconfigure.SimpleRabbitListenerContainerFactoryConfigurer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitMqConfiguration {
    @Bean
    fun messageConverter(): MessageConverter = JacksonJsonMessageConverter("mossymailershared.event")

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
