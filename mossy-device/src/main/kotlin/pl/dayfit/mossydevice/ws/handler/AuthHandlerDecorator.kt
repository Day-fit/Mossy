package pl.dayfit.mossydevice.ws.handler

import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.crypto.Ed25519Verifier
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
import tools.jackson.module.kotlin.convertValue
import tools.jackson.module.kotlin.readValue
import java.text.ParseException
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

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
            .get() //if the device does not exist, an exception would be thrown in `getAndConsumeNonce` logic

        val publicDh = device.publicKeyDH
        val publicId = device.publicKeyId

        val expectedPayload = publicDh.x.decode() + expectedNonce
        try {
            val jws = JWSObject.parse(signature)
            val verifier = Ed25519Verifier(publicId)

            if (!jws.verify(verifier)) {
                throw BadCredentialsException("Invalid token")
            }

            val result = jws.payload.toBytes().contentEquals(expectedPayload)

            if (result) {
                return
            }

            throw BadCredentialsException("Invalid token")
        } catch (_: ParseException) {
            throw BadCredentialsException("Invalid token")
        }
    }
}