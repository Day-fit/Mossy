package pl.dayfit.mossykeysync.service

import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.exception.RoleAlreadyInRoomException
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom
import pl.dayfit.mossykeysync.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossykeysync.type.KeySyncRole
import pl.dayfit.mossykeysync.ws.dto.WebSocketMessageDto
import pl.dayfit.mossykeysync.ws.dto.WebSocketServerMessageDto
import pl.dayfit.mossykeysync.ws.principal.DevicePrincipal
import java.security.SecureRandom
import java.util.UUID

@Service
class KeySyncService(
    private val keySyncRoomRepository: KeySyncRoomRepository,
    private val sessionService: WebSocketSessionService,
    private val notifier: WebSocketPeerNotifier,
    private val secureRandom: SecureRandom
) {
    @Throws(RoleAlreadyInRoomException::class)
    @Synchronized
    fun handleDeviceJoinedSync(
        syncCode: String,
        principal: DevicePrincipal,
        signature: String,
        webSocketSession: WebSocketSession
    ) {
        val deviceId = principal.deviceId
        val room = findRoom(principal.userId, syncCode)

        val role = if (room.receiverId == deviceId) KeySyncRole.RECEIVER else KeySyncRole.SENDER

        when (role) {
            KeySyncRole.SENDER -> {
                if (room.senderPresent) throw RoleAlreadyInRoomException("Sender already in room")
                room.senderId = deviceId
                room.senderPresent = true
                room.senderDh = principal.publicDhKey.x()
                room.senderSignature = signature
                room.senderSignatureAccepted = null
            }
            KeySyncRole.RECEIVER -> {
                if (room.receiverPresent) throw RoleAlreadyInRoomException("Receiver already in room")
                room.receiverPresent = true
                room.receiverDh = principal.publicDhKey.x()
                room.receiverSignature = signature
                room.receiverSignatureAccepted = null
            }
        }

        webSocketSession.attributes["role"] = role
        keySyncRoomRepository.save(room)

        if (room.senderPresent && room.receiverPresent) notifyPeerDetails(room)
    }

    private fun notifyPeerDetails(room: KeySyncRoom) {
        val senderId = requireNotNull(room.senderId)
        val receiverSession = sessionService.getSession(room.receiverId)
        val senderSession = sessionService.getSession(senderId)
        if (receiverSession == null || senderSession == null) return

        val receiverMessage = WebSocketServerMessageDto.PeerDetails(
            peerDeviceId = senderId,
            peerDhKey = requireNotNull(room.senderDh),
            signature = requireNotNull(room.senderSignature),
            vaultId = room.vaultId
        )

        val senderMessage = WebSocketServerMessageDto.PeerDetails(
            peerDeviceId = room.receiverId,
            peerDhKey = requireNotNull(room.receiverDh),
            signature = requireNotNull(room.receiverSignature),
            vaultId = room.vaultId
        )

        notifier.send(receiverSession, receiverMessage)
        notifier.send(senderSession, senderMessage)
    }

    @Synchronized
    fun handleSignatureStatus(
        message: WebSocketMessageDto.SignatureStatus,
        session: WebSocketSession
    ) {
        val room = roomFor(session)

        if (!message.signatureAccepted) {
            keySyncRoomRepository.delete(room)
            notifySignatureStatus(room, false)
            return
        }

        when (session.attributes["role"] as KeySyncRole) {
            KeySyncRole.RECEIVER -> room.receiverSignatureAccepted = true
            KeySyncRole.SENDER -> room.senderSignatureAccepted = true
        }
        keySyncRoomRepository.save(room)

        if (room.receiverSignatureAccepted == true && room.senderSignatureAccepted == true) {
            notifySignatureStatus(room, true)
        }
    }

    private fun notifySignatureStatus(room: KeySyncRoom, accepted: Boolean) {
        val message = WebSocketServerMessageDto.SignatureStatus(accepted)
        sessionService.getSession(room.receiverId)?.let { notifier.send(it, message) }
        room.senderId?.let(sessionService::getSession)?.let { notifier.send(it, message) }
    }

    @Throws(IllegalStateException::class, NoSuchElementException::class)
    fun handleSync(message: WebSocketMessageDto.KeySync, session: WebSocketSession) {
        val room = roomFor(session)

        check(session.attributes["role"] == KeySyncRole.SENDER) {
            "Only the sender can send key sync data"
        }
        check(room.receiverSignatureAccepted == true && room.senderSignatureAccepted == true) {
            "Both peer signatures must be accepted before key sync"
        }
        check(message.vaultId == room.vaultId) {
            "Key sync message does not belong to this room's vault"
        }

        val receiverSession = sessionService.getSession(room.receiverId)
            ?: throw IllegalStateException("No session for receiver, but room says that receiver is present")

        notifier.send(receiverSession, message)
    }

    @Synchronized
    fun handlePeerDisconnected(webSocketSession: WebSocketSession) {
        val role = webSocketSession.attributes["role"] as? KeySyncRole ?: return
        val room = runCatching { roomFor(webSocketSession) }.getOrNull() ?: return

        if (role == KeySyncRole.SENDER) {
            room.senderPresent = false
            room.senderId = null
            room.senderDh = null
            room.senderSignature = null
            room.senderSignatureAccepted = null
        } else {
            room.receiverPresent = false
            room.receiverDh = null
            room.receiverSignature = null
            room.receiverSignatureAccepted = null
        }

        keySyncRoomRepository.save(room)
    }

    fun initKeySync(
        userId: UUID,
        deviceId: UUID,
        vaultId: UUID
    ): InitKeySyncResponseDto {
        val code = generateSyncCode()
        val room = KeySyncRoom(
            roomId = null,
            code = code,
            vaultId = vaultId,
            userId = userId,
            receiverId = deviceId
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

    private fun roomFor(session: WebSocketSession): KeySyncRoom {
        val principal = session.attributes["principal"] as DevicePrincipal
        val syncCode = session.attributes["syncCode"] as String
        return findRoom(principal.userId, syncCode)
    }

    private fun findRoom(userId: UUID, syncCode: String): KeySyncRoom =
        keySyncRoomRepository.getKeySyncRoomsByUserId(userId)
            .firstOrNull { it.code == syncCode }
            ?: throw NoSuchElementException("No room with given code")

    private fun Map<String, Any>.x(): String =
        this["x"] as? String ?: throw IllegalArgumentException("DH public key is missing x")
}
