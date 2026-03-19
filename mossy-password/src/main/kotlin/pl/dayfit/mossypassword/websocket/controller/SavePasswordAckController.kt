package pl.dayfit.mossypassword.websocket.controller

import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.service.VaultCommunicationService

@Controller
class SavePasswordAckController(
    private val vaultCommunicationService: VaultCommunicationService
) {

    @MessageMapping("/vault/password-save-ack")
    fun handleSavePasswordAck(ack: SavePasswordAckRequestDto) {
        vaultCommunicationService.handleSavePasswordAck(ack)
    }
}
