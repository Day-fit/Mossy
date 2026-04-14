package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.request.type.AbstractVaultRequestType
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class VaultMessagingService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    fun sendMessageToTopic(topic: String, message: VaultRequestMessageDto<AbstractVaultRequestType>) {
        messagingTemplate.convertAndSendToUser(
            message.vaultId.toString(),
            "/vault/$topic",
            message
        )
    }
}