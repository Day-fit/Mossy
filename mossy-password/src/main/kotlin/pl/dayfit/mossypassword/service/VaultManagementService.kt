package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.request.type.DeletePasswordRequestType
import messaging.request.type.PasswordSaveRequestType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.exception.VaultFailedException
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
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = vaultCommunicationService.sendToVault(
            vaultId,
            VaultRequestMessageDto(
                UUID.randomUUID(),
                vaultId,
                PasswordSaveRequestType(
                    request.identifier,
                    request.domain,
                    request.cipherText,
                    PasswordSaveType.SAVE
                )
            )
        )

        val status = runCatching { future.get(30, TimeUnit.SECONDS) }
            .getOrElse { throw VaultFailedException("Vault responded with ") }
        if (status != VaultResponseStatus.OK) throw VaultFailedException("Vault responded with ")
    }

    fun updatePassword(userId: UUID, request: UpdatePasswordRequestDto) {
        val vaultId = request.vaultId
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = vaultCommunicationService.sendToVault(
            vaultId,
            VaultRequestMessageDto(
                UUID.randomUUID(),
                vaultId,
                PasswordSaveRequestType(
                    request.identifier,
                    request.domain,
                    request.cipherText,
                    PasswordSaveType.UPDATE
                )
            )
        )

        val status = runCatching { future.get(30, TimeUnit.SECONDS) }
            .getOrElse { throw VaultFailedException("Vault responded with ") }
        if (status != VaultResponseStatus.OK) throw VaultFailedException("Vault responded with ")
    }

    fun deletePassword(userId: UUID, request: DeletePasswordRequestDto) {
        val vaultId = request.vaultId
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = vaultCommunicationService.sendToVault(
            vaultId,
            VaultRequestMessageDto(
                UUID.randomUUID(),
                vaultId,
                DeletePasswordRequestType(
                    request.passwordId
                )
            )
        )
    }
}