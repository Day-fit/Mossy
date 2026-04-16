package pl.dayfit.mossypassword.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent

@Configuration
class KafkaProducerConfiguration(
    private val producerFactory: ProducerFactory<String, PasswordStatisticEvent>
) {
    @Bean
    fun kafkaTemplate() = KafkaTemplate(producerFactory)
}