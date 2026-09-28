package pl.dayfit.mossykeysync.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Service
class WebSocketSessionService(
    private val jsonMapper: JsonMapper
) {
    private val sessions = ConcurrentHashMap<UUID, WebSocketSession>()

    fun addSession(deviceId: UUID, session: WebSocketSession) {
        sessions[deviceId] = session
    }

    fun getSession(deviceId: UUID): WebSocketSession? {
        return sessions[deviceId]
    }

    fun removeSession(deviceId: UUID) {
        sessions.remove(deviceId)
    }

    fun send(session: WebSocketSession, message: Any) {
        session.sendMessage(TextMessage(jsonMapper.writeValueAsString(message)))
    }

    fun send(deviceId: UUID, message: Any) {
        sessions[deviceId]?.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(message)
            )
        ) ?: throw NoSuchElementException("No session found for device id $deviceId")
    }
}
