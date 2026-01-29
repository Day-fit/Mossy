package pl.dayfit.mossycore.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossycore.dto.request.SavePasswordRequestDto

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    fun savePassword(requestDto: SavePasswordRequestDto)
    {
        messagingTemplate.convertAndSendToUser(
            "Dummy!",
            "/vault/save",
            requestDto
        )
    }
}