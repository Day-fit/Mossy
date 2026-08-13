package pl.dayfit.mossykeysync.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper

@Service
class WebSocketPeerNotifier(
    private val jsonMapper: JsonMapper
) {
    fun send(session: WebSocketSession, message: Any) {
        session.sendMessage(TextMessage(jsonMapper.writeValueAsString(message)))
    }
}
