package pl.dayfit.mossykeysync.service

import org.springframework.amqp.core.AnonymousQueue
import org.springframework.stereotype.Service
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.exception.RoleAlreadyInRoomException
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom.Peer
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
    private val secureRandom: SecureRandom,
    private val replicaQueue: AnonymousQueue
) {
    @Throws(RoleAlreadyInRoomException::class)
    fun handleDeviceJoinedSync(
        syncCode: String,
        principal: DevicePrincipal,
        signature: String,
        webSocketSession: WebSocketSession
    ) {
        val deviceId = principal.deviceId
        val room = findRoom(principal.userId, syncCode)

        val role = if (room.receiver.id == deviceId) KeySyncRole.RECEIVER else KeySyncRole.SENDER

        when (role) {
            KeySyncRole.SENDER -> {
                if (room.sender?.isPresent == true) throw RoleAlreadyInRoomException("Sender already in room")

                room.sender = Peer(
                    id = deviceId,
                    diffieHellmanPk = principal.publicDhKey.x(),
                    signature = signature,
                    isPresent = true,
                    location = replicaQueue.name
                )
            }
            KeySyncRole.RECEIVER -> {
                val receiver = room.receiver
                if (receiver.isPresent) throw RoleAlreadyInRoomException("Receiver already in room")

                receiver.isPresent = true
                receiver.diffieHellmanPk = principal.publicDhKey.x()
                receiver.signature = signature
                receiver.signatureAccepted = null
            }
        }

        webSocketSession.attributes["role"] = role
        keySyncRoomRepository.save(room)

        if (room.receiver.isPresent && room.sender?.isPresent == true) notifyPeerDetails(room)
    }

    private fun notifyPeerDetails(room: KeySyncRoom) {
        val receiver = room.receiver
        val sender = requireNotNull(room.sender)

        val receiverSession = sessionService.getSession(receiver.id)
        val senderSession = sessionService.getSession(sender.id)
        if (receiverSession == null || senderSession == null) return

        val receiverMessage = WebSocketServerMessageDto.PeerDetails(
            peerDeviceId = sender.id,
            peerDhKey = requireNotNull(sender.diffieHellmanPk),
            signature = requireNotNull(sender.signature),
            vaultId = room.vaultId
        )

        val senderMessage = WebSocketServerMessageDto.PeerDetails(
            peerDeviceId = receiver.id,
            peerDhKey = requireNotNull(receiver.diffieHellmanPk),
            signature = requireNotNull(receiver.signature),
            vaultId = room.vaultId
        )

        sessionService.send(receiverSession, receiverMessage)
        sessionService.send(senderSession, senderMessage)
    }

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
            KeySyncRole.RECEIVER -> room.receiver.signatureAccepted = true
            KeySyncRole.SENDER -> checkNotNull(room.sender) { "No sender in room" }.signatureAccepted = true
        }

        keySyncRoomRepository.save(room)

        if (room.receiver.signatureAccepted == true && room.sender?.signatureAccepted == true) {
            notifySignatureStatus(room, true)
        }
    }

    private fun notifySignatureStatus(room: KeySyncRoom, accepted: Boolean) {
        val message = WebSocketServerMessageDto.SignatureStatus(accepted)
        sessionService.getSession(room.receiver.id)?.let { sessionService.send(it, message) }
        room.sender?.id?.let(sessionService::getSession)?.let { sessionService.send(it, message) }
    }

    @Throws(IllegalStateException::class, NoSuchElementException::class)
    fun handleSync(message: WebSocketMessageDto.KeySync, session: WebSocketSession) {
        val room = roomFor(session)

        check(session.attributes["role"] == KeySyncRole.SENDER) {
            "Only the sender can send key sync data"
        }
        check(room.receiver.signatureAccepted == true && room.sender?.signatureAccepted == true) {
            "Both peer signatures must be accepted before key sync"
        }
        check(message.vaultId == room.vaultId) {
            "Key sync message does not belong to this room's vault"
        }

        val receiverSession = sessionService.getSession(room.receiver.id)
            ?: throw IllegalStateException("No session for receiver, but room says that receiver is present")

        sessionService.send(receiverSession, message)
    }

    @Synchronized
    fun handlePeerDisconnected(webSocketSession: WebSocketSession) {
        val role = webSocketSession.attributes["role"] as? KeySyncRole ?: return
        val room = runCatching { roomFor(webSocketSession) }.getOrNull() ?: return

        if (role == KeySyncRole.SENDER) {
            room.sender = null
        } else {
            val receiver = room.receiver
            receiver.isPresent = false
            receiver.diffieHellmanPk = null
            receiver.signature = null
            receiver.signatureAccepted = null
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
            receiver = Peer(
                id = deviceId,
                location = replicaQueue.name
            )
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
