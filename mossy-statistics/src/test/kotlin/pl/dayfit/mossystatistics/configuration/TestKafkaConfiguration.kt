package pl.dayfit.mossystatistics.configuration

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Profile
import org.springframework.kafka.config.KafkaListenerContainerFactory
import org.springframework.kafka.listener.MessageListenerContainer
import org.springframework.test.context.bean.override.mockito.MockitoBean

@TestConfiguration
@Profile("test")
class TestKafkaConfiguration {
    
    @MockitoBean
    lateinit var kafkaListenerContainerFactory: KafkaListenerContainerFactory<MessageListenerContainer>
}

