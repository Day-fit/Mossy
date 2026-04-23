package pl.dayfit.mossydevice.ws.interceptor

import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor

/**
 * Extracts well-known query parameters from the WebSocket upgrade URL and
 * stores them in the session's attribute map so handlers can access them.
 *
 * Currently recognised parameters:
 *  - `syncCode` – the 6-digit key-sync room code supplied by the joining device.
 */
@Component
class QueryParamHandshakeInterceptor : HandshakeInterceptor {

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>
    ): Boolean {
        val query = request.uri.query ?: return true
        query.split("&").forEach { part ->
            val eq = part.indexOf('=')
            if (eq < 0) return@forEach
            val key = part.substring(0, eq)
            val value = part.substring(eq + 1)
            if (key == "syncCode") attributes["syncCode"] = value
        }
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?
    ) { /* no-op */ }
}
