package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckStatus
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordVaultRequestDto
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

        val vaultRequest = SavePasswordVaultRequestDto(
            identifier = requestDto.identifier,
            domain = requestDto.domain,
            cipherText = requestDto.cipherText,
            vaultId = requestDto.vaultId
        )

        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/save",
            vaultRequest
        )
    }

    /**
     * Handles ACK/NACK from vault after save operation.
     */
    fun handleSavePasswordAck(ack: SavePasswordAckRequestDto) {
        when (ack.status) {
            SavePasswordAckStatus.ACK -> {
                val passwordId = ack.passwordId
                if (passwordId == null) {
                    logger.warn("Received ACK without passwordId for vaultId={}", ack.vaultId)
                    return
                }

                statisticsEventPublisher.publish(
                    PasswordStatisticEvent(
                        vaultId = ack.vaultId,
                        passwordId = passwordId,
                        domain = ack.domain,
                        actionType = "added"
                    )
                )
            }

            SavePasswordAckStatus.NACK -> {
                logger.warn(
                    "Received NACK for vaultId={}, passwordId={}, reason={}",
                    ack.vaultId,
                    ack.passwordId,
                    ack.reason ?: "not provided"
                )
            }
        }
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