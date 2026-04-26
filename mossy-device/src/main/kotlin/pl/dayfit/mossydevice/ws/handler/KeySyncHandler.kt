package pl.dayfit.mossydevice.ws.handler

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.dto.response.GenericServerResponseDto
import pl.dayfit.mossydevice.service.KeySyncService
import pl.dayfit.mossydevice.service.WebSocketSessionService
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import tools.jackson.databind.DatabindException
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue
import java.util.UUID

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
            val dto = jsonMapper.readValue<WebSocketMessageDto.KeySync>(textMessage.payload)
            keySyncService.handleSync(dto, session)
        } catch (_: DatabindException){
            logger.debug("Received invalid payload, ignoring it")
            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(
                        GenericServerResponseDto("Invalid payload")
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
        val deviceId = runCatching { UUID.fromString(session.attributes["deviceId"] as String)}
            .getOrNull()

        if (deviceId == null) {
            logger.debug("No deviceId found in session, ignoring it")
            return
        }

        keySyncService.handlePeerDisconnected(session)
        webSocketSessionService.removeSession(deviceId)
    }

    override fun supportsPartialMessages(): Boolean {
        return false
    }
}