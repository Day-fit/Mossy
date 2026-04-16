package pl.dayfit.mossypassword.websocket.interceptor

import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import pl.dayfit.mossypassword.service.VaultAuthService
import pl.dayfit.mossypassword.service.VaultStatusService
import java.util.*

@Component
class VaultHandshakeInterceptor(
    private val vaultAuthService: VaultAuthService,
    private val vaultStatusService: VaultStatusService
) : HandshakeInterceptor {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultHandshakeInterceptor::class.java)

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>
    ): Boolean {
        val headers = request.headers

        val vaultIdHeader = headers.getFirst("x-vault-id")
            ?: return false.also { logReject("missing vault-id") }

        val vaultSecret = headers.getFirst("x-vault-secret")
            ?: return false.also { logReject("missing vault-secret") }

        val vaultId = runCatching { UUID.fromString(vaultIdHeader) }
            .getOrNull()
            ?: return false.also { logReject("invalid vault-id format") }

        if (!vaultAuthService.validate(vaultId, vaultSecret)) {
            return false.also { logReject("invalid credentials for vault-id=$vaultIdHeader") }
        }

        attributes["vaultId"] = vaultIdHeader
        vaultStatusService.markOnline(vaultId)

        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?
    ) = Unit

    private fun logReject(reason: String) {
        logger.warn("WebSocket handshake rejected: {}", reason)
    }
}