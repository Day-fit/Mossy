package pl.dayfit.mossydevice.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Service
class WebSocketSessionService {
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
}