package pl.dayfit.mossypassword.websocket.controller

import messaging.response.VaultResponseMessageDto
import messaging.response.type.CiphertextResponseType
import messaging.response.type.DeletePasswordResponseType
import messaging.response.type.MetadataResponseType
import messaging.response.type.SavePasswordResponseType
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.messaging.VaultPrincipal
import pl.dayfit.mossypassword.service.VaultMessageResolver
import java.util.UUID

@Controller
class VaultResponseController(
    private val vaultMessageResolver: VaultMessageResolver
) {
    @MessageMapping("/vault/metadata-retrieved")
    fun handleMetadataResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<MetadataResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/ciphertext-retrieved")
    fun handleCiphertextResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<CiphertextResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/password-saved")
    fun handleSaveResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<SavePasswordResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/password-deleted")
    fun handleDeleteResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<DeletePasswordResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }
}