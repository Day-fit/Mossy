package pl.dayfit.mossyvault.service

import jakarta.annotation.PostConstruct
import org.springframework.context.annotation.Profile
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketHttpHeaders
import org.springframework.web.socket.messaging.WebSocketStompClient
import pl.dayfit.mossyvault.configuration.properties.StompConfigurationProperties
import pl.dayfit.mossyvault.configuration.properties.VaultConfigurationProperties
import pl.dayfit.mossyvault.messaging.handler.VaultStompSessionHandler

@Service
@Profile("!test")
class StompCommunicationService(
    private val vaultStompSessionHandler: VaultStompSessionHandler,
    private val stompConfigurationProperties: StompConfigurationProperties,
    private val vaultConfigurationProperties: VaultConfigurationProperties,
    private val stompClient: WebSocketStompClient,
) {
    @PostConstruct
    fun init() {
        val connectHeaders = StompHeaders().apply {
            set("vault-id", vaultConfigurationProperties.id.toString())
            set("vault-secret", vaultConfigurationProperties.secret)
        }

        stompClient.connectAsync(
            "${stompConfigurationProperties.host}/api/v1/ws/vault-communication",
            WebSocketHttpHeaders(),
            connectHeaders,
            vaultStompSessionHandler
        )
    }
}
