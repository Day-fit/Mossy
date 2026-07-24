package pl.dayfit.mossyauth.configuration

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestTemplate

@Configuration
class DownstreamServicesConfiguration {
    @Bean
    fun restTemplate() = RestTemplate()
}