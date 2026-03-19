package pl.dayfit.mossystatistics.configuration

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestClient

@Configuration
class RestClientConfiguration(
    @Value("\${mossy.password.base-url}")
    private val mossyPasswordBaseUrl: String
) {
    @Bean
    fun mossyPasswordRestClient(): RestClient {
        return RestClient.builder()
            .baseUrl(mossyPasswordBaseUrl)
            .build()
    }
}
