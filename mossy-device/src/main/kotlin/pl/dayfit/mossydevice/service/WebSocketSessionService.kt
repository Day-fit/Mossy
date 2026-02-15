package pl.dayfit.mossydevice.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Service
class WebSocketSessionService {
    private val sessions = ConcurrentHashMap<UUID, WebSocketSession>()

    fun addSession(userId: UUID, session: WebSocketSession) {
        sessions[userId] = session
    }

    fun getSession(userId: UUID): WebSocketSession? {
        return sessions[userId]
    }

    fun removeSession(userId: UUID) {
        sessions.remove(userId)
    }
}