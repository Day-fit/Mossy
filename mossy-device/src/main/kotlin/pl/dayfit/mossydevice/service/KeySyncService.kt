package pl.dayfit.mossydevice.service

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.dto.response.KeySyncInfoResponseDto
import pl.dayfit.mossydevice.exception.RoleAlreadyInRoomException
import pl.dayfit.mossydevice.model.redis.KeySyncRoom
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import pl.dayfit.mossydevice.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossydevice.type.KeySyncRole
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
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

        if (role == KeySyncRole.SENDER) {
            if (room.senderPresent) throw RoleAlreadyInRoomException("Sender already in room")
            room.senderId = deviceId
            room.senderPresent = true
        }

        if (role == KeySyncRole.RECEIVER) {
            if (room.receiverPresent) throw RoleAlreadyInRoomException("Receiver already in room")
            room.receiverPresent = true
        }

        if (room.senderPresent && room.receiverPresent)
        {
            handleBothPeerPresent(room.receiverId, room.senderId!!)
        }

        webSocketSession.attributes["role"] = role
        keySyncRoomRepository.save(room)
    }

    fun handleBothPeerPresent(receiverId: UUID, senderId: UUID)
    {
        val receiverSession = sessionService.getSession(receiverId)
        val senderSession = sessionService.getSession(senderId)

        senderSession?.sendMessage(TextMessage("both_peer_present"))
        receiverSession?.sendMessage(TextMessage("both_peer_present"))
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
            logger.warn("Received sync message from unregistered device")
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
        val token = webSocketSession.principal as JwtAuthenticationToken

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(token.principal)
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

    fun getKeySyncInfo(code: String, userId: UUID, deviceId: UUID): KeySyncInfoResponseDto
    {
        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(userId)
            .filter { it.code == code }
            .getOrNull(0) ?: throw NoSuchElementException("No room with given code")

        if (userId != room.userId) throw AccessDeniedException("User does not have access to this room")
        val role = if (room.receiverId == deviceId) KeySyncRole.RECEIVER else KeySyncRole.SENDER
        val peerPresent = if (role == KeySyncRole.SENDER) room.receiverPresent else room.senderPresent

        var publicKeyDH: OctetKeyPair? = null
        var publicKeyId: OctetKeyPair? = null

        if (peerPresent)
        {
            val peerId = if (role == KeySyncRole.SENDER) room.receiverId else room.senderId
            val peerDevice = deviceRepository.findById(peerId!!)
                .orElseThrow { NoSuchElementException("No device with given id") }

            publicKeyId = peerDevice.publicKeyId
        }

        return KeySyncInfoResponseDto(
            peerPresent,
            publicKeyDH?.toJSONObject(),
            publicKeyId?.toJSONObject()
        )
    }

    fun initKeySync(
        userId: UUID,
        deviceId: UUID,
    ): InitKeySyncResponseDto {
        val isDeviceIdCorrect = deviceRepository.findById(deviceId)
            .map { it.userId == userId }
            .orElseThrow { NoSuchElementException("No device with given id") }

        if (!isDeviceIdCorrect) throw AccessDeniedException("Device does not belong to user")

        val code = generateSyncCode()
        val room = KeySyncRoom(
            roomId = null,
            code,
            userId,
            deviceId,
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