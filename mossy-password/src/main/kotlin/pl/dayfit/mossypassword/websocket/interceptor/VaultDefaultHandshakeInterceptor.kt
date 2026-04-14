package pl.dayfit.mossypassword.websocket.interceptor

import org.springframework.http.server.ServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.support.DefaultHandshakeHandler
import pl.dayfit.mossypassword.messaging.VaultPrincipal
import java.security.Principal

@Component
class VaultDefaultHandshakeInterceptor : DefaultHandshakeHandler() {
    override fun determineUser(
        request: ServerHttpRequest,
        wsHandler: WebSocketHandler,
        attributes: Map<String, Any>
    ): Principal? {
        val vaultId = attributes["vaultId"] as? String ?: return null
        return VaultPrincipal(vaultId)
    }
}