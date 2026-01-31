package pl.dayfit.mossycore.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossycore.dto.request.SavePasswordRequestDto
import java.util.UUID

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    /**
     * Sends a request to save a password in the specified vault.
     *
     * @param vaultId the unique identifier of the vault where the password will be saved.
     * @param requestDto the data transfer object containing the details of the password to be saved.
     */
    fun savePassword(vaultId: UUID, requestDto: SavePasswordRequestDto)
    {
        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/save",
            requestDto
        )
    }

    /**
     * Sends a request to delete a password from the specified vault.
     *
     * @param vaultId the unique identifier of the vault that contains the password to be deleted.
     * @param passwordId the unique identifier of the password to be deleted.
     */
    fun deletePassword(vaultId: UUID, passwordId: UUID)
    {
        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/delete",
            passwordId
        )
    }
}