package pl.dayfit.mossyvault.configuration

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.messaging.converter.JacksonJsonMessageConverter
import org.springframework.web.socket.sockjs.client.SockJsClient
import org.springframework.web.socket.sockjs.client.WebSocketTransport
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.messaging.WebSocketStompClient
import pl.dayfit.mossyvault.configuration.properties.StompConfigurationProperties

@Configuration
@EnableConfigurationProperties(StompConfigurationProperties::class)
class StompConfiguration {
    @Bean
    fun sockJsClient(): SockJsClient
    {
        val transports: List<WebSocketTransport> = listOf(
            WebSocketTransport(StandardWebSocketClient())
        )

        return SockJsClient(transports)
    }

    @Bean
    fun stompClient(): WebSocketStompClient
    {
        val client = WebSocketStompClient(sockJsClient())
        client.messageConverter = JacksonJsonMessageConverter()

        return client
    }
}