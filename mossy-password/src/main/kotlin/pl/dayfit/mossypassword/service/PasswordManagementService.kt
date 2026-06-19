package pl.dayfit.mossypassword.service

import messaging.request.type.CiphertextRequestType
import messaging.response.type.CiphertextResponseType
import messaging.request.type.DeletePasswordRequestType
import messaging.request.type.MetadataRequestType
import messaging.request.type.SavePasswordRequestType
import messaging.request.type.UpdatePasswordRequestType
import messaging.response.type.DeletePasswordResponseType
import messaging.response.type.MetadataResponseType
import messaging.response.type.SavePasswordResponseType
import messaging.response.type.UpdatePasswordResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import java.util.UUID
import java.util.concurrent.CompletableFuture

/**
 * Service responsible for handling password management requests (CRUD).
 */
@Service
class PasswordManagementService(
    private val vaultCommunicationService: VaultCommunicationService,
) {
    fun savePassword(userId: UUID, request: SavePasswordRequestDto) {
        val vaultId = request.vaultId
        val payload = SavePasswordRequestType(
            identifier = request.identifier,
            address = request.address,
            cipherText = request.cipherText,
            passwordType = request.passwordType
        )

        vaultCommunicationService.handleProcessing<SavePasswordResponseType>(userId, vaultId, payload)
    }

    fun updatePassword(userId: UUID, request: UpdatePasswordRequestDto) {
        val vaultId = request.vaultId
        val payload = UpdatePasswordRequestType(
            passwordId = request.passwordId,
            identifier = request.identifier,
            address = request.address,
            cipherText = request.cipherText
        )

        vaultCommunicationService.handleProcessing<UpdatePasswordResponseType>(userId, vaultId, payload)
    }

    fun deletePassword(userId: UUID, request: DeletePasswordRequestDto) {
        val vaultId = request.vaultId
        vaultCommunicationService.handleProcessing<DeletePasswordResponseType>(userId, vaultId, DeletePasswordRequestType(request.passwordId))
    }

    fun getPasswordsMetadata(userId: UUID, vaultId: UUID): CompletableFuture<MetadataResponseType> {
        return vaultCommunicationService.handleProcessing(userId, vaultId, MetadataRequestType())
    }

    fun getPasswordCipherText(
        userId: UUID,
        vaultId: UUID,
        passwordId: UUID
    ): CompletableFuture<CiphertextResponseType> {
        return vaultCommunicationService.handleProcessing(userId, vaultId, CiphertextRequestType(passwordId))
    }
}
