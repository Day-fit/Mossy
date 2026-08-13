package pl.dayfit.mossykeysync.ws.handler

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossykeysync.dto.response.GenericServerResponseDto
import pl.dayfit.mossykeysync.service.KeySyncService
import pl.dayfit.mossykeysync.service.WebSocketSessionService
import pl.dayfit.mossykeysync.type.MessageType
import pl.dayfit.mossykeysync.ws.dto.WebSocketMessageDto
import pl.dayfit.mossykeysync.ws.principal.DevicePrincipal
import tools.jackson.databind.DatabindException
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue

@Component
class KeySyncHandler(
    private val webSocketSessionService: WebSocketSessionService,
    private val keySyncService: KeySyncService,
    private val jsonMapper: JsonMapper
) : WebSocketHandler {
    private val logger = LoggerFactory.getLogger(KeySyncHandler::class.java)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        logger.debug("New WebSocket session established: {}", session.id)
    }

    override fun handleMessage(
        session: WebSocketSession,
        message: WebSocketMessage<*>
    ) {
        val textMessage = message as? TextMessage

        if (textMessage == null) {
            logger.debug("Received invalid payload, ignoring it")
            return
        }

        try {
            val json = jsonMapper.readTree(textMessage.payload)
            when (MessageType.valueOf(json.get("type").asString())) {
                MessageType.SIGNATURE_STATUS -> keySyncService.handleSignatureStatus(
                    jsonMapper.readValue<WebSocketMessageDto.SignatureStatus>(textMessage.payload),
                    session
                )
                MessageType.KEY_SYNC -> keySyncService.handleSync(
                    jsonMapper.readValue<WebSocketMessageDto.KeySync>(textMessage.payload),
                    session
                )
                MessageType.AUTH_FRAME -> throw IllegalArgumentException("Session is already authenticated")
            }
        } catch (_: DatabindException) {
            logger.debug("Received invalid payload, ignoring it")
            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(
                        GenericServerResponseDto("Invalid payload")
                    )
                )
            )
        } catch (_: IllegalArgumentException) {
            logger.debug("Received unsupported message type")
            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(
                        GenericServerResponseDto("Invalid message type")
                    )
                )
            )
        } catch (_: NoSuchElementException) {
            logger.debug("Room with such join code was not found, ignoring it")
            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(
                        GenericServerResponseDto("Room with such join code was not found")
                    )
                )
            )
            session.close()
        } catch (e: Exception) {
            logger.error("Unhandled error occurred while handling sync message", e)
        }
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
        val principal = session.attributes["principal"] as? DevicePrincipal

        if (principal == null) {
            logger.debug("No principal found in session, ignoring it")
            return
        }

        keySyncService.handlePeerDisconnected(session)
        webSocketSessionService.removeSession(principal.deviceId)
    }

    override fun supportsPartialMessages(): Boolean {
        return false
    }
}
