package pl.dayfit.mossypassword.websocket.controller

import org.springframework.messaging.handler.annotation.Header
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.dto.vault.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.service.VaultCommunicationService
import java.util.UUID

@Controller
class SavePasswordAckController(
    private val vaultCommunicationService: VaultCommunicationService
) {

    @MessageMapping("/vault/password-save-ack")
    fun handleSavePasswordAck(@Header("vault-id") vaultId: UUID, ack: SavePasswordAckRequestDto) {
        vaultCommunicationService.handleSavePasswordAck(vaultId, ack)
    }
}
