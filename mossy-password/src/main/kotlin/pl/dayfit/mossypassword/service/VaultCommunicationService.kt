package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckStatus
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.messaging.StatisticsEventPublisher
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

@Service
class VaultCommunicationService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val statisticsEventPublisher: StatisticsEventPublisher,
    private val vaultRepository: VaultRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(VaultCommunicationService::class.java)
    private val pendingSaveRequests: MutableMap<UUID, PendingSaveRequest> = ConcurrentHashMap()

    private val maxSaveRetries = 3
    private val ackTimeoutMillis = 2000L

    /**
     * Sends a request to save a password in the specified vault.
     *
     * @param requestDto the data transfer object containing the details of the password to be saved.
     */
    fun savePassword(userId: UUID, requestDto: SavePasswordRequestDto): UUID {
        val vault = requireOwnedConnectedVault(userId, requestDto.vaultId)

        val passwordId = requestDto.passwordId ?: generateDeterministicPasswordId(
            vaultId = vault.id!!,
            domain = requestDto.domain,
            identifier = requestDto.identifier
        )

        val requestWithPasswordId = requestDto.copy(passwordId = passwordId)
        pendingSaveRequests[passwordId] = PendingSaveRequest(requestWithPasswordId)

        dispatchSave(passwordId, requestDto.vaultId)
        return passwordId
    }

    /**
     * Handles ACK/NACK from vault after save operation.
     */
    fun handleSavePasswordAck(ack: SavePasswordAckRequestDto) {
        val pending = pendingSaveRequests[ack.passwordId]

        if (pending == null) {
            logger.warn("Received {} for unknown password id={}", ack.status, ack.passwordId)
            return
        }

        when (ack.status) {
            SavePasswordAckStatus.ACK -> {
                if (pending.acknowledged.compareAndSet(false, true)) {
                    statisticsEventPublisher.publish(
                        PasswordStatisticEvent(
                            vaultId = ack.vaultId,
                            passwordId = ack.passwordId,
                            domain = ack.domain,
                            actionType = "added"
                        )
                    )
                    pendingSaveRequests.remove(ack.passwordId)
                }
            }

            SavePasswordAckStatus.NACK -> {
                logger.warn(
                    "Received NACK for password id={}, vaultId={}, reason={}",
                    ack.passwordId,
                    ack.vaultId,
                    ack.reason ?: "not provided"
                )

                dispatchSave(ack.passwordId, ack.vaultId)
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

    private fun dispatchSave(passwordId: UUID, vaultId: UUID) {
        val pending = pendingSaveRequests[passwordId] ?: return

        if (pending.acknowledged.get()) {
            return
        }

        val attempt = pending.attempts.incrementAndGet()
        if (attempt > maxSaveRetries) {
            pendingSaveRequests.remove(passwordId)
            logger.error(
                "Save request failed after {} attempts, passwordId={}, vaultId={}",
                maxSaveRetries,
                passwordId,
                vaultId
            )
            return
        }

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/save",
            pending.request
        )

        scheduleAckTimeout(passwordId, vaultId)
    }

    private fun scheduleAckTimeout(passwordId: UUID, vaultId: UUID) {
        java.util.concurrent.CompletableFuture.delayedExecutor(ackTimeoutMillis, TimeUnit.MILLISECONDS)
            .execute {
                val pending = pendingSaveRequests[passwordId] ?: return@execute
                if (pending.acknowledged.get()) {
                    return@execute
                }

                logger.warn(
                    "No ACK received within {}ms for passwordId={}, vaultId={}, resending",
                    ackTimeoutMillis,
                    passwordId,
                    vaultId
                )
                dispatchSave(passwordId, vaultId)
            }
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

    private fun generateDeterministicPasswordId(vaultId: UUID, domain: String, identifier: String): UUID {
        val input = "$vaultId:$domain:$identifier".toByteArray()
        val bytes = MessageDigest.getInstance("SHA-1").digest(input)

        bytes[6] = (bytes[6].toInt() and 0x0f or 0x50).toByte()
        bytes[8] = (bytes[8].toInt() and 0x3f or 0x80).toByte()

        val mostSigBits = bytes.slice(0..7)
            .foldIndexed(0L) { i, acc, byte -> acc or (byte.toLong() and 0xFFL shl (8 * (7 - i))) }
        val leastSigBits = bytes.slice(8..15)
            .foldIndexed(0L) { i, acc, byte -> acc or (byte.toLong() and 0xFFL shl (8 * (7 - i))) }

        return UUID(mostSigBits, leastSigBits)
    }

    private data class PendingSaveRequest(
        val request: SavePasswordRequestDto,
        val attempts: AtomicInteger = AtomicInteger(0),
        val acknowledged: AtomicBoolean = AtomicBoolean(false)
    )
}