package pl.dayfit.mossydevice.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Future

@Service
class WebSocketSessionService(
    private val roomRepository: KeySyncRoomRepository
) {
    private val pendingSessions = ConcurrentHashMap<UUID, CompletableFuture<WebSocketSession>>()
    private val sessions = ConcurrentHashMap<UUID, WebSocketSession>()

    fun addSessionWhenAccepted(deviceId: UUID, session: WebSocketSession): Future<WebSocketSession> {
        val future = CompletableFuture<WebSocketSession>()
        pendingSessions[deviceId] = future

        return future
    }

    fun sessionAccepted(deviceId: UUID, session: WebSocketSession, peerDeviceId: UUID) {
        val syncCode = session.attributes["code"] as? String
        val role = session.attributes["role"] as? String

        val room = roomRepository.getKeySyncRoomsByUserId(deviceId)
            .filter { it -> it.code == syncCode }
            .getOrNull(0) ?: throw NoSuchElementException("")

        pendingSessions.remove(deviceId)?.thenAccept {
            sessions[peerDeviceId] = it
        } ?: throw NoSuchElementException("No session for $peerDeviceId")
    }

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