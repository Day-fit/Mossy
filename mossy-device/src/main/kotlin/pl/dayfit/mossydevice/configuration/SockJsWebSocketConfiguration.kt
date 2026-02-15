package pl.dayfit.mossydevice.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossydevice.handler.KeySyncHandler

@Profile("!raw-websocket")
@Configuration
@EnableWebSocket
class SockJsWebSocketConfiguration(
    private val keySyncHandler: KeySyncHandler,
    private val securityConfigurationProperties: SecurityConfigurationProperties
): WebSocketConfigurer{
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(keySyncHandler, "/ws/key-sync")
            .setAllowedOriginPatterns(*securityConfigurationProperties.allowedOrigins.toTypedArray())
            .withSockJS()
    }
}