package pl.dayfit.mossyvault.service

import jakarta.annotation.PostConstruct
import org.springframework.stereotype.Service
import org.springframework.web.socket.messaging.WebSocketStompClient
import pl.dayfit.mossyvault.configuration.properties.StompConfigurationProperties
import pl.dayfit.mossyvault.messaging.handler.VaultStompSessionHandler

@Service
class StompCommunicationService(
    private val vaultStompSessionHandler: VaultStompSessionHandler,
    private val stompConfigurationProperties: StompConfigurationProperties,
    private val stompClient: WebSocketStompClient,
) {
    @PostConstruct
    fun init() {
        stompClient.connectAsync(
            "${stompConfigurationProperties.host}/ws/vault-communication",
            vaultStompSessionHandler
        )
    }
}