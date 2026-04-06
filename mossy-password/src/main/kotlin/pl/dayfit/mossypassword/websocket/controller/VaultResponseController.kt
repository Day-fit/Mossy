package pl.dayfit.mossypassword.websocket.controller

import org.springframework.messaging.handler.annotation.Header
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.dto.vault.response.CiphertextResponseDto
import pl.dayfit.mossypassword.dto.vault.response.DeletePasswordResponse
import pl.dayfit.mossypassword.dto.vault.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService
import java.util.UUID

@Controller
class VaultResponseController(
    private val passwordQueryService: PasswordQueryService
) {
    @MessageMapping("/vault/passwords-queried")
    fun handleResponse(@Header("vault-id") vaultId: UUID, response: PasswordQueryResponseDto) {
        passwordQueryService.handlePasswordQueryResponse(vaultId, response)
    }

    @MessageMapping("/vault/ciphertext-retrieved")
    fun handleCiphertextResponse(@Header("vault-id") vaultId: UUID, response: CiphertextResponseDto) {
        passwordQueryService.handleCiphertextResponse(vaultId, response)
    }

    @MessageMapping("/vault/password-deleted")
    fun handleDeleteResponse(@Header("vault-id") vaultId: UUID, response: DeletePasswordResponse) {
        passwordQueryService.handleDeleteResponse(vaultId, response)
    }
}