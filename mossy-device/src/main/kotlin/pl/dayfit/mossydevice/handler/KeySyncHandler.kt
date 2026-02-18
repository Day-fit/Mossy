package pl.dayfit.mossydevice.handler

import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.service.KeySyncService
import pl.dayfit.mossydevice.service.WebSocketSessionService
import java.util.UUID

@Component
class KeySyncHandler(
    private val webSocketSessionService: WebSocketSessionService,
    private val keySyncService: KeySyncService
) : WebSocketHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(KeySyncHandler::class.java)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        logger.debug("New WebSocket session established: {}", session.id)

        keySyncService.handleDeviceJoinedSync(session.attributes["syncCode"] as String, session)
        webSocketSessionService.addSession(session.attributes["deviceId"] as UUID, session)
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
        val deviceId = session.attributes["deviceId"] as UUID
        val syncCode = session.attributes["syncCode"] as String

        keySyncService.handlePeerDisconnected(session)
        webSocketSessionService.removeSession(deviceId)
    }

    override fun supportsPartialMessages(): Boolean {
        return false
    }
}