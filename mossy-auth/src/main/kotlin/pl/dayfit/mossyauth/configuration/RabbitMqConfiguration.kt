package pl.dayfit.mossyauth.configuration

import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitMqConfiguration {
    @Bean
    fun messageConverter(): MessageConverter = JacksonJsonMessageConverter()
}
