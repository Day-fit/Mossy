package pl.dayfit.mossydevice.ws.handler

import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.crypto.Ed25519Verifier
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthenticationProvider
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationTokenCandidate
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.service.NonceService
import pl.dayfit.mossydevice.service.WebSocketSessionService
import pl.dayfit.mossydevice.type.MessageType
import pl.dayfit.mossydevice.ws.dto.FrameMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.convertValue
import java.text.ParseException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

@Component
class AuthFrameSocketHandler(
    private val jsonMapper: JsonMapper,
    private val jwtAuthenticationProvider: JwtAuthenticationProvider,
    private val webSocketSessionService: WebSocketSessionService,
    private val userDeviceRepository: UserDeviceRepository,
    private val nonceService: NonceService
) : TextWebSocketHandler() {
    private val pendingSessions = ConcurrentHashMap<WebSocketSession, CompletableFuture<DevicePrincipal>>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        pendingSessions[session] = CompletableFuture<DevicePrincipal>().thenApply {
            webSocketSessionService.addSession(
                it.deviceId,
                session
            )
            it
        }
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val json = jsonMapper.readTree(message.payload)
        val type = MessageType.valueOf(json.get("type").asString());

        when (type) {
            MessageType.AUTH_FRAME -> {
                val dto = jsonMapper.convertValue<FrameMessageDto.AuthFrame>(message.payload)

                try {
                    handleAuth(dto)
                    val candidate = JwtAuthenticationTokenCandidate(
                        dto.token
                    )

                    val authentication = jwtAuthenticationProvider.authenticate(candidate)

                    pendingSessions[session]?.complete(
                        DevicePrincipal(
                            dto.deviceId,
                            authentication
                        )
                    )
                } catch (e: BadCredentialsException) {

                } catch (e: Exception) {
                    session.sendMessage(TextMessage("auth failed"))
                    session.close()
                    pendingSessions.remove(session)
                }
            }

            MessageType.MESSAGE -> {

            }
        }
    }

    private fun handleAuth(authFrame: FrameMessageDto.AuthFrame) {
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