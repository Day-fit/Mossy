package pl.dayfit.mossyvault.service

import jakarta.annotation.PostConstruct
import org.springframework.context.annotation.Profile
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketHttpHeaders
import org.springframework.web.socket.messaging.WebSocketStompClient
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.configuration.properties.StompConfigurationProperties
import pl.dayfit.mossyvault.configuration.properties.VaultConfigurationProperties

@Service
@Profile("!test")
class StompCommunicationService(
    private val vaultStompSessionHandler: pl.dayfit.mossyvault.messaging.handler.VaultStompSessionHandler,
    private val stompConfigurationProperties: StompConfigurationProperties,
    private val vaultConfigurationProperties: VaultConfigurationProperties,
    private val stompClient: WebSocketStompClient,
) {
    @PostConstruct
    fun init() {
        val headers = WebSocketHttpHeaders()
        headers.put("x-vault-id", listOf(vaultConfigurationProperties.id.toString()))
        headers.put("x-vault-secret", listOf(vaultConfigurationProperties.secret))

        stompClient.connectAsync(
            "${stompConfigurationProperties.host}/api/v1/passwords${StompEndpoints.WEBSOCKET_ENDPOINT}",
            headers,
            StompHeaders(),
            vaultStompSessionHandler
        )
    }
}
