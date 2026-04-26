package pl.dayfit.mossydevice.configuration

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossydevice.ws.handler.AuthHandlerDecorator
import pl.dayfit.mossydevice.ws.interceptor.QueryParamHandshakeInterceptor

@Profile("!raw-websocket")
@Configuration
@EnableWebSocket
class SockJsWebSocketConfiguration(
    private val authHandlerDecorator: AuthHandlerDecorator,
    private val securityConfigurationProperties: SecurityConfigurationProperties,
    private val queryParamHandshakeInterceptor: QueryParamHandshakeInterceptor
): WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(authHandlerDecorator, "/ws/key-sync")
            .addInterceptors(queryParamHandshakeInterceptor)
            .setAllowedOriginPatterns(*securityConfigurationProperties.allowedOrigins.toTypedArray())
            .withSockJS()
    }
}