package pl.dayfit.mossypassword.websocket.controller

import messaging.VaultResponseMessageDto
import messaging.response.type.CiphertextResponseType
import messaging.response.type.DeletePasswordResponseType
import messaging.response.type.MetadataResponseType
import messaging.response.type.SavePasswordResponseType
import org.springframework.messaging.handler.annotation.Header
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.service.VaultMessageResolver
import java.util.UUID

@Controller
class VaultResponseController(
    private val vaultMessageResolver: VaultMessageResolver
) {
    @MessageMapping("/vault/metadata-retrieved")
    fun handleResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<MetadataResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }

    @MessageMapping("/vault/ciphertext-retrieved")
    fun handleCiphertextResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<CiphertextResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }

    @MessageMapping("/vault/password-saved")
    fun handleSaveResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<SavePasswordResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }

    @MessageMapping("/vault/password-deleted")
    fun handleDeleteResponse(@Header("vault-id") vaultId: UUID, response: VaultResponseMessageDto<DeletePasswordResponseType>) {
        vaultMessageResolver.handleResponse(vaultId, response)
    }
}