package pl.dayfit.mossydevice.ws.handler

import org.springframework.security.authentication.BadCredentialsException
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.WebSocketHandlerDecorator
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.service.NonceService
import pl.dayfit.mossydevice.service.WebSocketSessionService
import pl.dayfit.mossydevice.type.MessageType
import pl.dayfit.mossydevice.ws.dto.FrameMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue
import java.security.Signature
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import kotlin.io.encoding.Base64

@Component
class AuthHandlerDecorator(
    private val jsonMapper: JsonMapper,
    private val webSocketSessionService: WebSocketSessionService,
    private val userDeviceRepository: UserDeviceRepository,
    private val nonceService: NonceService,
    keySyncHandler: KeySyncHandler
) : WebSocketHandlerDecorator(keySyncHandler) {
    private val pendingSessions = ConcurrentHashMap<String, CompletableFuture<DevicePrincipal>>()
    private val logger = org.slf4j.LoggerFactory.getLogger(AuthHandlerDecorator::class.java)

    override fun afterConnectionEstablished(session: WebSocketSession) {
        pendingSessions[session.id] = CompletableFuture<DevicePrincipal>().thenApply {
            webSocketSessionService.addSession(
                it.deviceId,
                session
            )
            it
        }.orTimeout(5, TimeUnit.SECONDS)
            .whenComplete { _: DevicePrincipal?, _: Throwable? ->
                pendingSessions.remove(session.id)
            }
            .exceptionally { ex ->
                if (ex.cause is TimeoutException) {
                    unauthorized(session)
                    session.close()
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

        val json = jsonMapper.readTree(text)
        val type = runCatching { MessageType.valueOf(json.get("type").asString()) }
            .getOrNull()

        if (type != MessageType.AUTH_FRAME) {
            unauthorized(session)
            return
        }

        handleAuthFrame(session, jsonMapper.readValue<FrameMessageDto.AuthFrame>(text))
    }

    private fun handleAuthFrame(session: WebSocketSession, dto: FrameMessageDto.AuthFrame) {
        runCatching {
            verifySignatureAndPayload(dto)
            DevicePrincipal(dto.deviceId)
        }.onSuccess { principal ->
            pendingSessions[session.id]?.complete(principal)
        }.onFailure { ex ->
            when (ex) {
                is BadCredentialsException -> unauthorized(session)
                is NoSuchElementException -> notFound(session, ex.message)

                else -> {
                    logger.error("Unexpected exception during authentication", ex)
                    session.sendMessage(TextMessage("auth failed"))
                    pendingSessions.remove(session.id)
                }
            }
        }
    }

    private fun unauthorized(session: WebSocketSession) {
        session.sendMessage(TextMessage("unauthorized"))
        session.close()
    }

    private fun notFound(session: WebSocketSession, message: String?) {
        session.sendMessage(TextMessage(message ?: "not found"))
        session.close()
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: org.springframework.web.socket.CloseStatus) {
        super.afterConnectionClosed(session, status)
        val deviceId = session.attributes["deviceId"] as? UUID
            ?: return

        webSocketSessionService.removeSession(deviceId)
    }

    private fun isAuthenticated(session: WebSocketSession) =
        session.attributes["principal"] != null

    private fun verifySignatureAndPayload(authFrame: FrameMessageDto.AuthFrame) {
        val signature = authFrame.signature
        val deviceId = authFrame.deviceId

        val expectedNonce = nonceService.getAndConsumeNonce(deviceId)
        val device = userDeviceRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device with id: $deviceId") }

        val expectedPayload = device.publicKeyDH.x.decode() + expectedNonce
        val signatureBytes = runCatching { Base64.UrlSafe.decode(signature) }
            .getOrElse { throw BadCredentialsException("Invalid token") }

        val verifier = Signature.getInstance("Ed25519")
        verifier.initVerify(device.publicKeyId.toPublicKey())
        verifier.update(expectedPayload)

        if (!verifier.verify(signatureBytes)) {
            throw BadCredentialsException("Invalid token")
        }
    }
}
