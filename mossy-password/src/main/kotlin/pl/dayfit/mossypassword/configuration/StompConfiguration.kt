package pl.dayfit.mossypassword.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import pl.dayfit.mossypassword.websocket.interceptor.VaultHandshakeInterceptor

@Configuration
@EnableWebSocketMessageBroker
class StompConfiguration(
    private val vaultHandshakeInterceptor: VaultHandshakeInterceptor,
) : WebSocketMessageBrokerConfigurer {
    override fun configureMessageBroker(config: MessageBrokerRegistry) {
        config.enableSimpleBroker("/vault")
        config.setApplicationDestinationPrefixes("/app")
        config.setUserDestinationPrefix("/user")
    }

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws/vault-communication")
            .setAllowedOrigins("*")
            .addInterceptors(vaultHandshakeInterceptor)
            .withSockJS()
    }
}
