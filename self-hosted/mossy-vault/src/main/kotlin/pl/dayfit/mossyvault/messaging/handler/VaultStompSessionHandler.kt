package pl.dayfit.mossyvault.messaging.handler

import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.messaging.simp.stomp.StompSessionHandler
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.messaging.consumer.DeletePasswordHandler
import pl.dayfit.mossyvault.messaging.consumer.ExtractCiphertextHandler
import pl.dayfit.mossyvault.messaging.consumer.GetCiphertextHandler
import pl.dayfit.mossyvault.messaging.consumer.QueryPasswordsByDomainHandler
import pl.dayfit.mossyvault.messaging.consumer.SavePasswordHandler
import pl.dayfit.mossyvault.messaging.consumer.UpdatePasswordHandler
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type

@Component
class VaultStompSessionHandler(
    private val savePasswordHandler: SavePasswordHandler,
    private val deletePasswordHandler: DeletePasswordHandler,
    private val updatePasswordHandler: UpdatePasswordHandler,
    private val extractCiphertextHandler: ExtractCiphertextHandler,
    private val queryPasswordsByDomainHandler: QueryPasswordsByDomainHandler,
    private val getCiphertextHandler: GetCiphertextHandler,
    private val stompSessionRegistry: StompSessionRegistry,
) : StompSessionHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultStompSessionHandler::class.java)

    override fun afterConnected(
        session: StompSession,
        connectedHeaders: StompHeaders
    ) {
        stompSessionRegistry.setSession(session)

        session.subscribe(
            "/user/vault/save",
            savePasswordHandler
        )

        session.subscribe(
            "/user/vault/delete",
            deletePasswordHandler
        )

        session.subscribe(
            "/user/vault/update",
            updatePasswordHandler
        )

        session.subscribe(
            "/user/vault/extract-ciphertext",
            extractCiphertextHandler
        )

        session.subscribe(
            "/user/vault/query-by-domain",
            queryPasswordsByDomainHandler
        )

        session.subscribe(
            "/user/vault/get-ciphertext",
            getCiphertextHandler
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