package pl.dayfit.mossystatistics.configuration

import org.apache.kafka.clients.admin.NewTopic
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.TopicBuilder

@Configuration
class KafkaConfiguration {
    @Bean
    fun passwordStatisticTopic(
        @Value($$"${mossy.kafka.topics.password-statistic.name}") name: String,
        @Value($$"${mossy.kafka.topics.password-statistic.partitions}") partitions: Int,
        @Value($$"${mossy.kafka.topics.password-statistic.replicas}") replicas: Int,
    ): NewTopic =
        TopicBuilder.name(name)
            .partitions(partitions)
            .replicas(replicas)
            .build()
}