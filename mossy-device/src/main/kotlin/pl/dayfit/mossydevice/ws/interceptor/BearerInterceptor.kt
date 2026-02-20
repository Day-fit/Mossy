package pl.dayfit.mossydevice.ws.interceptor

import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthenticationProvider
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationTokenCandidate
import java.lang.Exception

@Component
class BearerInterceptor(
    private val jwtAuthenticationProvider: JwtAuthenticationProvider
) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: Map<String, Any>
    ): Boolean {
        response.headers["Sec-WebSocket-Protocol"] = "v1"
        val protocolHeaders = request.headers["Sec-WebSocket-Protocol"]
            ?.flatMap { it.split(",") }
            ?.map { it.trim() }

        if (protocolHeaders == null) {
            unauthorized(response,"Sec-WebSocket-Protocol header is required")
            return false
        }

        if (protocolHeaders.size != 2) {
            unauthorized(response, "Invalid Sec-WebSocket-Protocol header")
            return false
        }

        val candidate = JwtAuthenticationTokenCandidate(
            protocolHeaders[1]
        )

        val authenticationToken = jwtAuthenticationProvider.authenticate(
            candidate
        )

        SecurityContextHolder.getContext().authentication = authenticationToken
        return true
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
        response.body.write("{\"message\": \"${ exception.message ?: "Unauthorized" }\"".toByteArray())
    }

    private fun unauthorized(response: ServerHttpResponse, message: String? = null)
    {
        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        response.body.write("{\"message\": \"${ message ?: "Unauthorized" }\"".toByteArray())
    }
}