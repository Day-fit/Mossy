package pl.dayfit.mossydevice.service

import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.exception.RoleAlreadyInRoomException
import pl.dayfit.mossydevice.model.redis.KeySyncRoom
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossydevice.type.KeySyncRole
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import pl.dayfit.mossydevice.ws.dto.WebSocketServerMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import tools.jackson.databind.json.JsonMapper
import java.security.SecureRandom
import java.util.UUID

@Service
class KeySyncService (
    private val deviceRepository: UserDeviceRepository,
    private val keySyncRoomRepository: KeySyncRoomRepository,
    private val sessionService: WebSocketSessionService,
    private val jsonMapper: JsonMapper,
    private val secureRandom: SecureRandom,
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(KeySyncService::class.java)

    @Throws(RoleAlreadyInRoomException::class)
    fun handleDeviceJoinedSync(syncCode: String, webSocketSession: WebSocketSession)
    {
        val principal = webSocketSession.attributes["principal"] as DevicePrincipal
        val deviceId = principal.deviceId
        val userId = principal.userId

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(userId)
            .filter { it.code == syncCode }
            .getOrNull(0) ?: throw NoSuchElementException("No room with given code")

        val role: KeySyncRole = if (room.receiverId == deviceId) KeySyncRole.RECEIVER
            else KeySyncRole.SENDER

        val device = deviceRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device with given id") }

        if (role == KeySyncRole.SENDER) {
            if (room.senderPresent) throw RoleAlreadyInRoomException("Sender already in room")
            room.senderId = deviceId
            room.senderPresent = true
            room.senderDh = principal.publicDhKey["x"] as String
            room.senderIdKey = device.publicKeyId.x.toString()
        }

        if (role == KeySyncRole.RECEIVER) {
            if (room.receiverPresent) throw RoleAlreadyInRoomException("Receiver already in room")
            room.receiverPresent = true
            room.receiverDh = principal.publicDhKey["x"] as String
        }

        if (room.senderPresent && room.receiverPresent)
        {
            handleBothPeerPresent(room.receiverId, room.senderId!!, room)
        }

        webSocketSession.attributes["role"] = role
        keySyncRoomRepository.save(room)
    }

    fun handleBothPeerPresent(receiverId: UUID, senderId: UUID, room: KeySyncRoom)
    {
        val receiverSession = sessionService.getSession(receiverId)
        val senderSession = sessionService.getSession(senderId)

        if (receiverSession == null || senderSession == null) return

        val receiverMessage = WebSocketServerMessageDto.PeerDetails(
            room.senderIdKey!!,
            room.senderDh!!,
            room.vaultId,
        )

        val senderMessage = WebSocketServerMessageDto.PeerDetails(
            room.receiverIdKey,
            room.receiverDh!!,
            room.vaultId,
        )

        receiverSession.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(receiverMessage)
            )
        )

        senderSession.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(senderMessage)
            )
        )
    }

    @Throws(IllegalStateException::class, NoSuchElementException::class)
    fun handleSync(message: WebSocketMessageDto.KeySync, session: WebSocketSession)
    {
        val code = session.attributes["syncCode"] as String
        val principal = session.attributes["principal"] as DevicePrincipal

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(principal.userId)
            .filter { it.code == code }
            .getOrNull(0) ?: throw NoSuchElementException("No room with given code")

        val receiverId = room.receiverId

        if (!room.receiverPresent) {
            logger.debug("Receiver not present in room, ignoring message")
            return
        }

        val receiverSession = sessionService.getSession(receiverId)
            ?: throw IllegalStateException("No session for receiver, but room says that receiver is present")

        receiverSession.sendMessage(
            TextMessage(
                jsonMapper.writeValueAsString(message)
            )
        )
    }

    fun handlePeerDisconnected(webSocketSession: WebSocketSession)
    {
        val role = webSocketSession.attributes["role"] as KeySyncRole
        val syncCode = webSocketSession.attributes["syncCode"] as String
        val devicePrincipal = webSocketSession.attributes["principal"] as DevicePrincipal

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(
            devicePrincipal.userId
        )
            .filter { it.code == syncCode }
            .getOrNull(0) ?: throw NoSuchElementException("No room with given code")

        if (role == KeySyncRole.SENDER) {
            room.senderPresent = false
            room.senderId = null
        } else {
            room.receiverPresent = false
        }

        keySyncRoomRepository.save(room)
    }

    fun initKeySync(
        userId: UUID,
        deviceId: UUID,
        vaultId: UUID
    ): InitKeySyncResponseDto {
        val device = deviceRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device with given id") }

        if (device.userId != userId) throw AccessDeniedException("Device does not belong to user")

        val code = generateSyncCode()
        val room = KeySyncRoom(
            roomId = null,
            code,
            vaultId,
            userId,
            deviceId,
            receiverIdKey = device.publicKeyId.x.toString(),
        )

        keySyncRoomRepository.save(room)

        return InitKeySyncResponseDto(
            code
        )
    }

    /**
     * Generates 6-digit sync code
     * @return generated sync code
     */
    private fun generateSyncCode(): String {
        val randomInt = secureRandom.nextInt(1, 1_000_000)
        return String.format("%06d", randomInt)
    }
}