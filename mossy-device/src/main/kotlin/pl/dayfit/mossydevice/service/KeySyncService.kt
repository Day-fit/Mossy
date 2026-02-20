package pl.dayfit.mossydevice.service

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import pl.dayfit.mossydevice.dto.response.KeySyncInfoResponseDto
import pl.dayfit.mossydevice.dto.ws.KeySyncDto
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

    @Throws(RoleAlreadyInRoomException::class)
    fun handleDeviceJoinedSync(syncCode: String, webSocketSession: WebSocketSession)
    {
        val principal = webSocketSession.principal as JwtAuthenticationToken
        val userId = principal.principal
        val deviceId = webSocketSession.attributes["deviceId"] as UUID

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(userId)
            .filter { it.code == syncCode }
            .getOrNull(0) ?: throw NoSuchElementException("No room with given code")

        val role: KeySyncRole = if (room.receiverId == deviceId) KeySyncRole.SENDER else KeySyncRole.RECEIVER

        if (role == KeySyncRole.SENDER) {
            if (room.senderPresent) throw RoleAlreadyInRoomException("Sender already in room")
            room.senderId = deviceId
            room.senderPresent = true
        }

        if (role == KeySyncRole.RECEIVER) {
            if (room.receiverPresent) throw RoleAlreadyInRoomException("Receiver already in room")
            room.receiverPresent = true
        }

        webSocketSession.attributes["role"] = role
        keySyncRoomRepository.save(room)
    }

    @Throws(IllegalStateException::class, NoSuchElementException::class)
    fun handleSync(message: KeySyncDto, session: WebSocketSession)
    {
        val code = session.attributes["syncCode"] as String
        val token = session.principal as JwtAuthenticationToken
        val userId = token.principal

        val room = keySyncRoomRepository.getKeySyncRoomsByUserId(userId)
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
            val peerDevice = deviceRepository.findById(peerId)
                .orElseThrow { NoSuchElementException("No device with given id") }

            publicKeyDH = peerDevice.publicKeyDH
            publicKeyId = peerDevice.publicKeyId
        }

        return KeySyncInfoResponseDto(
            peerPresent,
            publicKeyDH?.toJSONObject(),
            publicKeyId?.toJSONObject()
        )
    }
}