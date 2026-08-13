package pl.dayfit.mossykeysync.ws.handler

import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.WebSocketHandlerDecorator
import pl.dayfit.mossykeysync.service.KeySyncService
import pl.dayfit.mossykeysync.service.WebSocketAuthenticationService
import pl.dayfit.mossykeysync.service.WebSocketSessionService
import pl.dayfit.mossykeysync.type.AuthFrameStatus
import pl.dayfit.mossykeysync.type.MessageType
import pl.dayfit.mossykeysync.ws.dto.AuthFrameResponseDto
import pl.dayfit.mossykeysync.ws.dto.WebSocketMessageDto
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

@Component
class AuthHandlerDecorator(
    private val jsonMapper: JsonMapper,
    private val webSocketSessionService: WebSocketSessionService,
    private val keySyncService: KeySyncService,
    private val authenticationService: WebSocketAuthenticationService,
    keySyncHandler: KeySyncHandler
) : WebSocketHandlerDecorator(keySyncHandler) {
    private val pendingSessions = ConcurrentHashMap<String, CompletableFuture<WebSocketAuthenticationService.AuthenticatedPeer>>()
    private val logger = org.slf4j.LoggerFactory.getLogger(AuthHandlerDecorator::class.java)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val future = CompletableFuture<WebSocketAuthenticationService.AuthenticatedPeer>()
        pendingSessions[session.id] = future

        future.thenAccept { peer ->
            session.attributes["principal"] = peer.principal
            webSocketSessionService.addSession(peer.principal.deviceId, session)
            try {
                keySyncService.handleDeviceJoinedSync(
                    syncCode = session.attributes["syncCode"] as String,
                    principal = peer.principal,
                    signature = peer.signature,
                    webSocketSession = session
                )
            } catch (_: NoSuchElementException) {
                webSocketSessionService.removeSession(peer.principal.deviceId)
                notFound(session, "No room with such join code")
                return@thenAccept
            } catch (ex: Exception) {
                logger.error("Failed to admit authenticated peer to key sync room", ex)
                webSocketSessionService.removeSession(peer.principal.deviceId)
                unauthorized(session, "Unable to join key sync room")
                return@thenAccept
            }

            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(AuthFrameResponseDto(AuthFrameStatus.SUCCEEDED))
                )
            )
            super.afterConnectionEstablished(session)
        }
            .orTimeout(5, TimeUnit.SECONDS)
            .whenComplete { _: Any?, _: Any? ->
                pendingSessions.remove(session.id)
            }
            .exceptionally { ex ->
                if (ex is TimeoutException || ex.cause is TimeoutException) {
                    unauthorized(session, "Authentication timed out")
                }
                null
            }
    }

    override fun handleMessage(session: WebSocketSession, message: WebSocketMessage<*>) {
        if (isAuthenticated(session)) {
            super.handleMessage(session, message)
            return
        }

        val text = (message as? TextMessage)?.payload ?: run {
            unauthorized(session)
            return
        }

        val dto = runCatching {
            val json = jsonMapper.readTree(text)
            check(MessageType.valueOf(json.get("type").asString()) == MessageType.AUTH_FRAME)
            jsonMapper.readValue<WebSocketMessageDto.AuthFrame>(text)
        }.getOrElse {
            unauthorized(session)
            return
        }

        handleAuthFrame(session, dto)
    }

    private fun handleAuthFrame(session: WebSocketSession, dto: WebSocketMessageDto.AuthFrame) {
        runCatching {
            authenticationService.authenticate(dto)
        }.onSuccess { peer ->
            pendingSessions[session.id]?.complete(peer)
        }.onFailure { ex ->
            logger.debug("WebSocket authentication failed", ex)
            pendingSessions.remove(session.id)?.cancel(false)
            unauthorized(session)
        }
    }

    private fun unauthorized(session: WebSocketSession, message: String? = null) {
        session.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(
                    AuthFrameResponseDto(
                        status = AuthFrameStatus.FAILED,
                        message = message
                    )
                )
            )
        )
        session.close()
    }

    private fun notFound(session: WebSocketSession, message: String?) {
        session.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(
                    AuthFrameResponseDto(
                        status = AuthFrameStatus.NOT_FOUND,
                        message = message
                    )
                )
            )
        )
        session.close()
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: org.springframework.web.socket.CloseStatus) {
        if (!isAuthenticated(session)) {
            pendingSessions.remove(session.id)
            return
        }

        super.afterConnectionClosed(session, status)
    }

    private fun isAuthenticated(session: WebSocketSession) =
        session.attributes["principal"] != null
}
