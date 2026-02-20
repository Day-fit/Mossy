package pl.dayfit.mossydevice.ws.interceptor

import com.nimbusds.jose.JWSObject
import com.nimbusds.jose.crypto.Ed25519Verifier
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import pl.dayfit.mossydevice.exception.RequiredHeaderNullException
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.service.NonceService
import java.lang.Exception
import java.text.ParseException
import java.util.UUID

@Component
class KeySyncInterceptor(
    private val nonceService: NonceService,
    private val userDeviceRepository: UserDeviceRepository
) : HandshakeInterceptor {

    /**
     * Intercepts the WebSocket handshake request and validates the necessary headers for establishing a secure connection.
     * This method performs checks on the `Sec-WebSocket-Protocol` header to authenticate the client and process the handshake.
     *
     * @param request The incoming HTTP request containing headers and other metadata.
     * @param response The outgoing HTTP response used to customize the handshake process.
     * @param wsHandler The WebSocket handler responsible for processing the WebSocket communication.
     * @param attributes A mutable map to store attributes to be passed to the WebSocket session.
     * @return `true` if the handshake process is successfully validated, otherwise `false`.
     * @throws RequiredHeaderNullException If any required header (e.g., `Sec-WebSocket-Protocol`, `deviceId`, `signature`) is missing.
     */
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
            unauthorized(response,"Sec-WebSocket-Protocol header is required")
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
            .get() //if the device does not exist, an exception would be thrown in `getAndConsumeNonce` logic

        val publicDh = device.publicKeyDH
        val publicId = device.publicKeyId

        val expectedPayload = publicDh.x.decode() + expectedNonce
        try {
            val jws = JWSObject.parse(signature)
            val verifier = Ed25519Verifier(publicId)

            if (!jws.verify(verifier)) {
                unauthorized(response, "Invalid signature")
                return false
            }

            val result = jws.payload.toBytes().contentEquals(expectedPayload)

            if (!result) {
                unauthorized(response, "Invalid signature")
            }

            return result
        } catch (_: ParseException) {
            unauthorized(response, "Invalid signature")
            return false
        }
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
        response.body.write("{\"message\": \"${ exception.message ?: "Unauthorized" }\"}".toByteArray())
    }

    private fun unauthorized(response: ServerHttpResponse, message: String? = null)
    {
        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        response.body.write("{\"message\": \"${ message ?: "Unauthorized" }\"}".toByteArray())
    }
}