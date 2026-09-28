package pl.dayfit.mossykeysync.service

import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Service
import pl.dayfit.mossykeysync.dto.messaging.PeerRequestMessage
import pl.dayfit.mossykeysync.dto.messaging.PeerResponseMessage
import pl.dayfit.mossykeysync.exception.MessageForwardingFailed
import pl.dayfit.mossykeysync.repository.redis.KeySyncRoomRepository
import java.util.UUID

@Service
class PeerCommunicationService(
    private val asyncRabbitTemplate: AsyncRabbitTemplate,
    private val keySyncRoomRepository: KeySyncRoomRepository,
    private val webSocketSessionService: WebSocketSessionService
) {
    fun sendMessage(roomId: String, peerId: UUID, messageDto: Any) {
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

        val response = asyncRabbitTemplate.convertSendAndReceive<PeerResponseMessage>(
            "key-sync.replica.exchange",
            replicaQueueId,
            messageDto
        )

        response.handle { message, throwable ->
            if (throwable != null) {
                throw throwable
            }

            if (message.status == PeerResponseMessage.Status.FAILED) {
                //TODO: better handling
                throw MessageForwardingFailed()
            }
        }
    }

    @RabbitListener(
        queues = ["#{@replicaQueue.name}"]
    ) fun receiveMessage(message: PeerRequestMessage<*>): PeerResponseMessage {
        try {
            webSocketSessionService.send(message.deviceId, message.data)

            return PeerResponseMessage(
                PeerResponseMessage.Status.SUCCESS,
            )
        } catch (_: Exception) {
            return PeerResponseMessage(
                PeerResponseMessage.Status.FAILED
            )
        }
    }
}