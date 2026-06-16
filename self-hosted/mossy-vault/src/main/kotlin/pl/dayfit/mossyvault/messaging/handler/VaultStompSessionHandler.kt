package pl.dayfit.mossyvault.messaging.handler

import messaging.request.type.VaultRequestType
import org.slf4j.LoggerFactory

import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.messaging.simp.stomp.StompSessionHandler
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.messaging.consumer.AbstractVaultRequestHandler
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type

@Component
class VaultStompSessionHandler(
    private val vaultRequestHandlers: List<AbstractVaultRequestHandler<VaultRequestType>>,
    private val stompSessionRegistry: StompSessionRegistry,
) : StompSessionHandler {
    private val logger = LoggerFactory.getLogger(VaultStompSessionHandler::class.java)

    override fun afterConnected(
        session: StompSession,
        connectedHeaders: StompHeaders
    ) {
        stompSessionRegistry.setSession(session)

        vaultRequestHandlers.forEach {
            handler -> session.subscribe(handler.getDestination(), handler)
        }
    }

    override fun handleException(
        session: StompSession,
        command: StompCommand?,
        headers: StompHeaders,
        payload: ByteArray,
        exception: Throwable
    ) {
        logger.error("Stomp exception occurred", exception)
    }

    override fun handleTransportError(
        session: StompSession,
        exception: Throwable
    ) {
        if (!session.isConnected) {
            stompSessionRegistry.clearSession(session)
        }

        logger.error("Stomp transport error occurred", exception)
    }

    override fun getPayloadType(headers: StompHeaders): Type {
        return Any::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        // Nothing to do here
    }
}