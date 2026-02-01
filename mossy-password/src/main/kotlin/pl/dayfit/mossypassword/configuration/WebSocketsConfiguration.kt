package pl.dayfit.mossypassword.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import pl.dayfit.mossypassword.websocket.handler.KeyHandshakeHandler

@Configuration
class WebSocketsConfiguration(
    private val keyHandshakeHandler: KeyHandshakeHandler
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(keyHandshakeHandler, "/ws/key-exchange")
            .setAllowedOrigins("*") //TODO: change to real origin when auth service is ready
            .withSockJS()
    }
}