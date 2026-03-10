package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.messaging.StatisticsEventPublisher
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import java.util.UUID

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val statisticsEventPublisher: StatisticsEventPublisher
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

        statisticsEventPublisher.publish(
            PasswordStatisticEvent(
                vaultId = vaultId,
                passwordId = UUID.randomUUID(),
                domain = requestDto.domain,
                actionType = "added"
            )
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
            DeletePasswordRequestDto(passwordId, vaultId)
        )

        statisticsEventPublisher.publish(
            PasswordStatisticEvent(
                vaultId = vaultId,
                passwordId = passwordId,
                domain = "unknown",
                actionType = "removed"
            )
        )
    }

    fun extractCiphertext(vaultId: UUID, passwordId: UUID)
    {
        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/extract-ciphertext",
            ExtractCiphertextRequestDto(passwordId, vaultId)
        )
    }

    fun updatePassword(requestDto: UpdatePasswordRequestDto)
    {
        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/update",
            requestDto
        )

        statisticsEventPublisher.publish(
            PasswordStatisticEvent(
                vaultId = requestDto.vaultId,
                passwordId = requestDto.passwordId,
                domain = requestDto.domain,
                actionType = "updated"
            )
        )
    }
}