package pl.dayfit.mossykeysync.service

import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossykeysync.repository.redis.KeySyncRoomRepository
import java.util.UUID

@Service
class PeerCommunicationService(
    private val asyncRabbitTemplate: AsyncRabbitTemplate,
    private val keySyncRoomRepository: KeySyncRoomRepository,
) {
    fun sendMessage(roomId: String, peerId: UUID) {
        val room = keySyncRoomRepository.findById(roomId)
            .orElseThrow()

        var replicaQueueId: String? = null

        if (peerId == room.sender?.id) {
           replicaQueueId = room.sender?.location
        }

        if (peerId == room.receiver.id) {
            replicaQueueId = room.receiver.location
        }

        checkNotNull(replicaQueueId)

        asyncRabbitTemplate.convertSendAndReceive<String>(
            "password.replica.exchange",
            replicaQueueId,
        )
    }
}