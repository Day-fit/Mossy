package pl.dayfit.mossypassword.service

import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.type.PasswordSaveRequestType
import pl.dayfit.mossypassword.exception.VaultFailedException
import pl.dayfit.mossypassword.helper.VaultHelper
import pl.dayfit.mossypassword.type.PasswordSaveType
import pl.dayfit.mossypassword.type.VaultResponseStatus
import java.util.UUID
import java.util.concurrent.TimeUnit

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

    fun updatePassword(userId: UUID, requestDto: UpdatePasswordRequestDto) {

    }
}