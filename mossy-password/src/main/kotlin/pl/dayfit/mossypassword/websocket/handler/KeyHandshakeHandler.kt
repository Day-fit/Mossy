package pl.dayfit.mossypassword.websocket.handler

import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketMessage
import org.springframework.web.socket.WebSocketSession

@Component
class KeyHandshakeHandler : WebSocketHandler {
    override fun afterConnectionEstablished(session: WebSocketSession?) {
        TODO("Not yet implemented")
    }

    override fun handleMessage(
        session: WebSocketSession?,
        message: WebSocketMessage<*>?
    ) {
        TODO("Not yet implemented")
    }

    override fun handleTransportError(
        session: WebSocketSession?,
        exception: Throwable?
    ) {
        TODO("Not yet implemented")
    }

    override fun afterConnectionClosed(
        session: WebSocketSession?,
        closeStatus: CloseStatus?
    ) {
        TODO("Not yet implemented")
    }

    override fun supportsPartialMessages(): Boolean {
        TODO("Not yet implemented")
    }
}