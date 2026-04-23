package pl.dayfit.mossydevice.ws.handler

import com.nimbusds.jose.jwk.OctetKeyPair
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.WebSocketHandlerDecorator
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.service.KeySyncService
import pl.dayfit.mossydevice.service.NonceService
import pl.dayfit.mossydevice.service.WebSocketSessionService
import pl.dayfit.mossydevice.type.AuthFrameStatus
import pl.dayfit.mossydevice.type.MessageType
import pl.dayfit.mossydevice.ws.dto.AuthFrameResponseDto
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue
import java.util.*
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
    private val keySyncService: KeySyncService,
    keySyncHandler: KeySyncHandler
) : WebSocketHandlerDecorator(keySyncHandler) {
    private val pendingSessions = ConcurrentHashMap<String, CompletableFuture<DevicePrincipal>>()
    private val logger = org.slf4j.LoggerFactory.getLogger(AuthHandlerDecorator::class.java)


    override fun afterConnectionEstablished(session: WebSocketSession) {
        val future = CompletableFuture<DevicePrincipal>()
        pendingSessions[session.id] = future

        future.thenApply {
            webSocketSessionService.addSession(it.deviceId, session)
            session.attributes["principal"] = it
            session.sendMessage(
                TextMessage(
                    jsonMapper.writeValueAsString(AuthFrameResponseDto(AuthFrameStatus.SUCCEEDED))
                )
            )

            try {
                keySyncService.handleDeviceJoinedSync(session.attributes["syncCode"] as String, session)
                webSocketSessionService.addSession(session.attributes["deviceId"] as UUID, session)
            } catch (_: NoSuchElementException) {
                notFound(session, "No room with such join code")
                session.close()
                return@thenApply it
            }

            super.afterConnectionEstablished(session)
            it
        }
            .orTimeout(5, TimeUnit.SECONDS)
            .whenComplete { _: DevicePrincipal?, _: Throwable? ->
                pendingSessions.remove(session.id)
            }
            .exceptionally { ex ->
                if (ex.cause is TimeoutException) {
                    unauthorized(session, "Authentication timed out")
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

        handleAuthFrame(session, jsonMapper.readValue<WebSocketMessageDto.AuthFrame>(text))

    }

    private fun handleAuthFrame(session: WebSocketSession, dto: WebSocketMessageDto.AuthFrame) {
        runCatching {
            verifySignatureAndPayload(dto)

            val device = userDeviceRepository.findById(dto.deviceId)
                .orElseThrow()

            DevicePrincipal(
                dto.deviceId,
                device.userId,
                dto.publicDh
            )
        }.onSuccess { principal ->
            pendingSessions[session.id]?.complete(principal)
        }.onFailure { ex ->
            when (ex) {
                is BadCredentialsException -> invalidSignature(session)
                is NoSuchElementException -> notFound(session, ex.message)

                else -> {
                    logger.error("Unexpected exception during authentication", ex)
                    unauthorized(session)
                    pendingSessions.remove(session.id)
                }
            }
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

    private fun invalidSignature(session: WebSocketSession) {
        session.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(
                    AuthFrameResponseDto(
                        status = AuthFrameStatus.INVALID_SIGNATURE,
                        message = "Invalid signature"
                    )
                )
            )
        )
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: org.springframework.web.socket.CloseStatus) {
        val deviceId = session.attributes["deviceId"] as? UUID
            ?: return

        webSocketSessionService.removeSession(deviceId)
    }

    private fun isAuthenticated(session: WebSocketSession) =
        session.attributes["principal"] != null

    private fun verifySignatureAndPayload(authFrame: WebSocketMessageDto.AuthFrame) {
        val deviceId = authFrame.deviceId

        val expectedNonce = nonceService.getAndConsumeNonce(deviceId)
        val device = userDeviceRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device with id: $deviceId") }

        val dh = OctetKeyPair.parse(authFrame.publicDh)
        val expectedPayload = dh.x.decode() + expectedNonce

        val signatureBytes =
            runCatching { Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT_OPTIONAL).decode(authFrame.signature) }
                .getOrElse { throw BadCredentialsException("Invalid signature") }

        val publicKeyBytes = device.publicKeyId.toPublicJWK().x.decode()
        val params = Ed25519PublicKeyParameters(publicKeyBytes, 0)

        val signer = Ed25519Signer().apply {
            init(false, params)
            update(expectedPayload, 0, expectedPayload.size)
        }

        if (!signer.verifySignature(signatureBytes)) {
            throw BadCredentialsException("Invalid token")
        }
    }
}
