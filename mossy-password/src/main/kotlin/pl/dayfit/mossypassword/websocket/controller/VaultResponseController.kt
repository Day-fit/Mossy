package pl.dayfit.mossypassword.websocket.controller

import org.springframework.messaging.handler.annotation.Header
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.dto.vault.type.CiphertextResponseType
import pl.dayfit.mossypassword.dto.vault.type.DeleteVaultResponseType
import pl.dayfit.mossypassword.dto.vault.type.PasswordQueryResponseType
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import pl.dayfit.mossypassword.service.VaultMessageResolver
import java.util.UUID

@Controller
class VaultResponseController(
    private val vaultMessageResolver: VaultMessageResolver
) {
    @MessageMapping("/vault/passwords-queried")
    fun handleResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<PasswordQueryResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }

    @MessageMapping("/vault/ciphertext-retrieved")
    fun handleCiphertextResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<CiphertextResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }

    @MessageMapping("/vault/password-deleted")
    fun handleDeleteResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<DeleteVaultResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }
}