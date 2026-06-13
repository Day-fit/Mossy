package pl.dayfit.mossypassword.service

import messaging.request.VaultRequestMessageDto
import messaging.request.type.VaultRequestType
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class VaultMessagingService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    fun sendMessageToTopic(topic: String, message: VaultRequestMessageDto<VaultRequestType>) {
        messagingTemplate.convertAndSendToUser(
            message.vaultId.toString(),
            "/vault/$topic",
            message
        )
    }
}