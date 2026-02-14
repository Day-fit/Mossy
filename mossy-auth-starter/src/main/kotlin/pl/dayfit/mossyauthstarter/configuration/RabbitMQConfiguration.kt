package pl.dayfit.mossyauthstarter.configuration

import org.springframework.amqp.support.converter.DefaultJacksonJavaTypeMapper
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.json.JsonMapper

@Configuration
class RabbitMQConfiguration {
    @Bean
    fun jacksonMessageConverter(jsonMapper: JsonMapper): JacksonJsonMessageConverter {
        val converter = JacksonJsonMessageConverter(jsonMapper)

        val typeMapper = DefaultJacksonJavaTypeMapper()
        typeMapper.setTrustedPackages(
            "pl.dayfit.mossyjwksevents.event",
            "java.util",
            "java.lang"
        )

        converter.javaTypeMapper = typeMapper
        return converter
    }
}