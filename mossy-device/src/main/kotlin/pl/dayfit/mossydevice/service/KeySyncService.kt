package pl.dayfit.mossydevice.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.exception.RoleAlreadyInRoomException
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossydevice.type.KeySyncRole
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

@Service
class KeySyncService (
    private val deviceRepository: UserDeviceRepository,
    private val keySyncRoomRepository: KeySyncRoomRepository,
    private val sessionService: WebSocketSessionService,
    private val jsonMapper: JsonMapper
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(KeySyncService::class.java)

    fun handleDeviceJoinedSync(roomId: String, webSocketSession: WebSocketSession)
    {
        val attributes = webSocketSession.attributes
        val role = attributes["role"] as KeySyncRole
        val deviceId = attributes["deviceId"] as UUID
        val deviceSession = sessionService.getSession(deviceId)

        val keySyncRoom = keySyncRoomRepository.findById(
            roomId
        ).orElseThrow { IllegalStateException("Device joined sync room that does not exist, bugged interceptor logic?") }

        when (role) {
            KeySyncRole.RECEIVER -> {
                if (keySyncRoom.receiverId != null) throw RoleAlreadyInRoomException("Receiver already in room")
                //TODO("Implement")
            }
            KeySyncRole.SENDER -> {
                if (keySyncRoom.senderId != null) throw RoleAlreadyInRoomException("Sender already in room")
                //TODO("Implement")
            }
        }
    }
}