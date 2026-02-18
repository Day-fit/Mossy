package pl.dayfit.mossydevice.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossydevice.handler.BearerInterceptor
import pl.dayfit.mossydevice.handler.KeySyncHandler
import pl.dayfit.mossydevice.handler.KeySyncInterceptor

@Profile("raw-websocket")
@Configuration
@EnableWebSocket
class RawWebSocketConfiguration(
    private val keySyncHandler: KeySyncHandler,
    private val keySyncInterceptor: KeySyncInterceptor,
    private val bearerInterceptor: BearerInterceptor,
    private val securityConfigurationProperties: SecurityConfigurationProperties
): WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(keySyncHandler, "/ws/key-sync")
            .addInterceptors(keySyncInterceptor, bearerInterceptor)
            .setAllowedOriginPatterns(*securityConfigurationProperties.allowedOrigins.toTypedArray())
    }
}