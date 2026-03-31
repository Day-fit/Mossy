package pl.dayfit.mossypassword.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckStatus
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordVaultRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.helper.VaultHelper
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.type.ActionType
import java.util.UUID

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val vaultHelper: VaultHelper,
    private val kafkaTemplate: KafkaTemplate<String, PasswordStatisticEvent>,
    private val vaultRepository: VaultRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultCommunicationService::class.java)

    @Value($$"${mossy.password.statistics.topic}")
    private lateinit var statisticsTopic: String

    /**
     * Sends a request to save a password in the specified vault.
     *
     * @param requestDto the data transfer object containing the details of the password to be saved.
     */
    fun savePassword(userId: UUID, requestDto: SavePasswordRequestDto) {
        vaultHelper.requireOwnedConnectedVault(userId, requestDto.vaultId)

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

                val vault = vaultRepository.findById(ack.vaultId)

                if (vault.isEmpty) {
                    logger.warn("Received ACK for non-existing vaultId={}", ack.vaultId)
                    return
                }

                kafkaTemplate.send(
                    statisticsTopic,
                    PasswordStatisticEvent(
                        vaultId = ack.vaultId,
                        passwordId = passwordId,
                        domain = ack.domain,
                        actionType = ActionType.ADDED,
                        userId = vault.get().ownerId
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
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/delete",
            DeletePasswordRequestDto(passwordId, vaultId)
        )

        kafkaTemplate.send(
            statisticsTopic,
            PasswordStatisticEvent(
                vaultId = vaultId,
                passwordId = passwordId,
                domain = "unknown",
                actionType = ActionType.REMOVED,
                userId = userId
            ))
    }

    fun extractCiphertext(userId: UUID, vaultId: UUID, passwordId: UUID) {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/extract-ciphertext",
            ExtractCiphertextRequestDto(passwordId, vaultId)
        )
    }

    fun updatePassword(userId: UUID, requestDto: UpdatePasswordRequestDto) {
        vaultHelper.requireOwnedConnectedVault(userId, requestDto.vaultId)

        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/update",
            requestDto
        )

        kafkaTemplate.send(
            statisticsTopic,
            PasswordStatisticEvent(
                vaultId = requestDto.vaultId,
                passwordId = requestDto.passwordId,
                domain = requestDto.domain,
                actionType = ActionType.UPDATED,
                userId = userId
            )
        )
    }
}