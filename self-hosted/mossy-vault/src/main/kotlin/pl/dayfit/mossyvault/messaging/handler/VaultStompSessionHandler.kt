package pl.dayfit.mossyvault.messaging.handler

import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.messaging.simp.stomp.StompSessionHandler
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.messaging.consumer.DeletePasswordHandler
import pl.dayfit.mossyvault.messaging.consumer.SavePasswordHandler
import java.lang.reflect.Type

@Component
class VaultStompSessionHandler(
    private val savePasswordHandler: SavePasswordHandler,
    private val deletePasswordHandler: DeletePasswordHandler
) : StompSessionHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultStompSessionHandler::class.java)

    override fun afterConnected(
        session: StompSession,
        connectedHeaders: StompHeaders
    ) {
        session.subscribe(
            "/vault/save",
            savePasswordHandler
        )

        session.subscribe(
            "/vault/delete",
            deletePasswordHandler
        )
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
        logger.error("Stomp transport error occurred", exception)
    }

    override fun getPayloadType(headers: StompHeaders): Type {
        return Any::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        // Nothing to do here
    }
}