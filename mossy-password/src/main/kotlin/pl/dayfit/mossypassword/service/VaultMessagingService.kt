package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultRequestType
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto

@Service
class VaultMessagingService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    fun sendMessageToTopic(topic: String, message: VaultRequestMessageDto<AbstractVaultRequestType>) {
        messagingTemplate.convertAndSend("/vault/$topic", message)
    }
}