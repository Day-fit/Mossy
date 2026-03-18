package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.messaging.StatisticsEventPublisher
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val statisticsEventPublisher: StatisticsEventPublisher,
    private val vaultRepository: VaultRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultCommunicationService::class.java)

    /**
     * Sends a request to save a password in the specified vault.
     *
     * @param requestDto the data transfer object containing the details of the password to be saved.
     */
    fun savePassword(userId: UUID, requestDto: SavePasswordRequestDto) {
        requireOwnedConnectedVault(userId, requestDto.vaultId)

        val requestWithMessageId = requestDto.copy(messageId = UUID.randomUUID())

        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/save",
            requestWithMessageId
        )
    }

    /**
     * Handles ACK/NACK from vault after save operation.
     * Kept for transport-level observability while save ownership remains in vault/DB.
     */
    fun handleSavePasswordAck(ack: SavePasswordAckRequestDto) {
        logger.info("Received {} for save messageId={}", ack.status, ack.messageId)
    }

    /**
     * Sends a request to delete a password from the specified vault.
     *
     * @param vaultId the unique identifier of the vault that contains the password to be deleted.
     * @param passwordId the unique identifier of the password to be deleted.
     */
    fun deletePassword(userId: UUID, vaultId: UUID, passwordId: UUID) {
        requireOwnedConnectedVault(userId, vaultId)

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

    fun extractCiphertext(userId: UUID, vaultId: UUID, passwordId: UUID) {
        requireOwnedConnectedVault(userId, vaultId)

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/extract-ciphertext",
            ExtractCiphertextRequestDto(passwordId, vaultId)
        )
    }

    fun updatePassword(userId: UUID, requestDto: UpdatePasswordRequestDto) {
        requireOwnedConnectedVault(userId, requestDto.vaultId)

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

    private fun requireOwnedConnectedVault(userId: UUID, vaultId: UUID): Vault {
        val vault = vaultRepository.findById(vaultId)
            .orElseThrow { VaultNotFoundException(vaultId) }

        if (vault.ownerId != userId) {
            throw VaultAccessDeniedException(vaultId)
        }

        if (!vault.isOnline) {
            throw VaultNotConnectedException(vaultId)
        }

        return vault
    }
}
