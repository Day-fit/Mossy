package pl.dayfit.mossydevice.ws.interceptor

import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.service.NonceService
import java.lang.Exception
import java.security.Signature
import java.util.UUID
import kotlin.io.encoding.Base64

@Component
class KeySyncInterceptor(
    private val nonceService: NonceService,
    private val userDeviceRepository: UserDeviceRepository
) : HandshakeInterceptor {

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>
    ): Boolean {
        val query = request.uri.query

        if (query == null) {
            unauthorized(response, "syncCode query parameter is required")
            return false
        }

        val syncCode = query
            .split("&")
            .mapNotNull {
                val (k, v) = it.split("=", limit = 2).let { p ->
                    if (p.size == 2) p[0] to p[1] else return@mapNotNull null
                }
                if (k == "syncCode") v else null
            }
            .firstOrNull()

        if (syncCode == null) {
            unauthorized(response, "syncCode query parameter is required")
            return false
        }

        attributes["syncCode"] = syncCode

        response.headers["Sec-WebSocket-Protocol"] = "v1"
        val protocolHeaders = request.headers["Sec-WebSocket-Protocol"]
            ?.flatMap { it.split(",") }
            ?.map { it.trim() }

        if (protocolHeaders == null) {
            unauthorized(response, "Sec-WebSocket-Protocol header is required")
            return false
        }

        if (protocolHeaders.size != 4) {
            unauthorized(response, "Invalid Sec-WebSocket-Protocol header")
            return false
        }

        if (protocolHeaders[0] != "v1") {
            response.setStatusCode(HttpStatus.CONFLICT)
            return false
        }

        val deviceId = protocolHeaders[2].let {
            try {
                val id = UUID.fromString(it)
                attributes["deviceId"] = id
                return@let id
            } catch (_: IllegalArgumentException) {
                unauthorized(response, "deviceId header is invalid")
                return false
            }
        }

        val signature = protocolHeaders[3]
        val expectedNonce = nonceService.getAndConsumeNonce(deviceId)
        val device = userDeviceRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device with given id") }

        val expectedPayload = device.publicKeyDH.x.decode() + expectedNonce
        val signatureBytes = runCatching { Base64.UrlSafe.decode(signature) }
            .getOrElse {
                unauthorized(response, "Invalid signature")
                return false
            }

        val verifier = Signature.getInstance("Ed25519")
        verifier.initVerify(device.publicKeyId.toPublicKey())
        verifier.update(expectedPayload)

        val isValid = verifier.verify(signatureBytes)
        if (!isValid) {
            unauthorized(response, "Invalid signature")
        }

        return isValid
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?
    ) {
        if (exception == null) {
            return
        }

        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        response.body.write("{\"message\": \"${exception.message ?: "Unauthorized"}\"}".toByteArray())
    }

    private fun unauthorized(response: ServerHttpResponse, message: String? = null) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        response.body.write("{\"message\": \"${message ?: "Unauthorized"}\"}".toByteArray())
    }
}
