package pl.dayfit.mossydevice.handler

import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import pl.dayfit.mossydevice.service.WebSocketSessionService

@Component
class KeySyncHandler(
    private val webSocketSessionService: WebSocketSessionService
) : WebSocketHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(KeySyncHandler::class.java)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        logger.debug("New WebSocket session established: {}", session.id)
        val sessionPrincipal = session.principal as? JwtAuthenticationToken
            ?: throw IllegalStateException("Principal is not a JWT token")

        webSocketSessionService.addSession(sessionPrincipal.principal, session)
    }

    override fun handleMessage(
        session: WebSocketSession,
        message: WebSocketMessage<*>
    ) {

    }

    override fun handleTransportError(
        session: WebSocketSession,
        exception: Throwable
    ) {
        logger.error("WebSocket transport error occurred", exception)
    }

    override fun afterConnectionClosed(
        session: WebSocketSession,
        closeStatus: CloseStatus
    ) {
        logger.debug("WebSocket session closed: {}", session.id)
        val sessionPrincipal = session.principal as? JwtAuthenticationToken
            ?: throw IllegalStateException("Principal is not a JWT token")

        webSocketSessionService.removeSession(sessionPrincipal.principal)
    }

    override fun supportsPartialMessages(): Boolean {
        return false
    }
}