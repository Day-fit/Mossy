package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.request.type.DeletePasswordRequestType
import messaging.request.type.MetadataRequestType
import messaging.request.type.SavePasswordRequestType
import messaging.response.type.AbstractVaultResponseType
import messaging.response.type.DeletePasswordResponseType
import messaging.response.type.SavePasswordResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.exception.VaultFailedException
import pl.dayfit.mossypassword.exception.VaultNotRespondedException
import pl.dayfit.mossypassword.helper.VaultHelper
import type.PasswordSaveType
import type.VaultResponseStatus
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.getOrElse
import kotlin.runCatching

@Service
class VaultManagementService(
    private val vaultCommunicationService: VaultCommunicationService,
    private val vaultHelper: VaultHelper
) {
    fun savePassword(userId: UUID, request: SavePasswordRequestDto) {
        val vaultId = request.vaultId
        val payload = SavePasswordRequestType(
            request.identifier,
            request.domain,
            request.cipherText,
            PasswordSaveType.SAVE
        )

        handleProcessing<SavePasswordResponseType>(userId, vaultId, payload)
    }

    fun updatePassword(userId: UUID, request: UpdatePasswordRequestDto) {
        val vaultId = request.vaultId
        val payload = SavePasswordRequestType(
            request.identifier,
            request.domain,
            request.cipherText,
            PasswordSaveType.UPDATE
        )

        handleProcessing<SavePasswordResponseType>(userId, vaultId, payload)
    }

    fun deletePassword(userId: UUID, request: DeletePasswordRequestDto) {
        val vaultId = request.vaultId
        handleProcessing<DeletePasswordResponseType>(userId, vaultId, DeletePasswordRequestType(request.passwordId))
    }

    fun getPasswordsMetadata(userId: UUID, vaultId: UUID): AbstractVaultResponseType {
        return handleProcessing(userId, vaultId, MetadataRequestType())
    }

    private fun <Res : AbstractVaultResponseType> handleProcessing(
        userId: UUID,
        vaultId: UUID,
        payload: AbstractVaultRequestType
    ): Res {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = vaultCommunicationService.sendToVault(
            vaultId,
            VaultRequestMessageDto(
                UUID.randomUUID(),
                vaultId,
                payload
            )
        )

        val response = runCatching { future.get(30, TimeUnit.SECONDS) }
            .getOrElse { throw VaultNotRespondedException("Timed out waiting for vault response") }

        when (response.status) {
            VaultResponseStatus.OK -> return response.payload as Res
            VaultResponseStatus.ERROR -> throw VaultFailedException("Vault responded with error")
            VaultResponseStatus.NOT_FOUND -> throw NoSuchElementException("Vault not found")
        }
    }
}