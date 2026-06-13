package pl.dayfit.mossypassword.websocket.controller

import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import messaging.response.type.CiphertextResponseType
import messaging.response.type.CreateTagResponseType
import messaging.response.type.DeletePasswordResponseType
import messaging.response.type.DeleteTagResponseType
import messaging.response.type.GetTagsResponseType
import messaging.response.type.MetadataResponseType
import messaging.response.type.SavePasswordResponseType
import messaging.response.type.UnassignTagResponseType
import messaging.response.type.UpdateTagResponseType
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

    @MessageMapping("/vault/tag-assigned")
    fun handleTagAssignedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<AssignTagResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/tag-unassigned")
    fun handleTagUnassignedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<UnassignTagResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/tag-saved")
    fun handleTagSavedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<CreateTagResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/tags-retrieved")
    fun handleTagsRetrievedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<GetTagsResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/tag-deleted")
    fun handleTagsDeletedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<DeleteTagResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }

    @MessageMapping("/vault/tag-updated")
    fun handleTagsAssignedResponse(@AuthenticationPrincipal vault: VaultPrincipal, response: VaultResponseMessageDto<UpdateTagResponseType>) {
        vaultMessageResolver.handleResponse(UUID.fromString(vault.name), response)
    }
}