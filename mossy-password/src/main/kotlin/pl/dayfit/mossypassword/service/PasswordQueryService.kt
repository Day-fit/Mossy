package pl.dayfit.mossypassword.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.vault.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.vault.request.PasswordMetadataDto
import pl.dayfit.mossypassword.dto.vault.response.CiphertextResponseDto
import pl.dayfit.mossypassword.dto.vault.response.DeletePasswordResponse
import pl.dayfit.mossypassword.dto.vault.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.dto.vault.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.vault.request.SavePasswordAckStatus
import pl.dayfit.mossypassword.dto.vault.request.SavePasswordVaultRequestDto
import pl.dayfit.mossypassword.helper.VaultHelper
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.messaging.dto.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossypassword.service.exception.VaultNotRespondedException
import pl.dayfit.mossypassword.type.ActionType
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.jvm.optionals.getOrNull

@Service
class PasswordQueryService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val vaultHelper: VaultHelper
) {

    private val pendingQueries: MutableMap<String, CompletableFuture<PasswordQueryResponseDto>> = ConcurrentHashMap()
    private val pendingCiphertexts: MutableMap<String, CompletableFuture<CiphertextResponseDto>> = ConcurrentHashMap()
    private val pendingDeletions: MutableMap<String, CompletableFuture<DeletePasswordResponse>> = ConcurrentHashMap()

    /**
     * Gets password metadata (without ciphertext) for a vault.
     */
    fun getPasswordsMetadata(userId: UUID, vaultId: UUID, domain: String?): List<PasswordMetadataDto> {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = CompletableFuture<PasswordQueryResponseDto>()
        val requestKey = "$vaultId:${domain ?: "*"}"

        pendingQueries[requestKey] = future

        val request = QueryPasswordsByDomainRequestDto(
            domain = domain,
            vaultId = vaultId
        )

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/query-by-domain",
            request
        )

         try {
            val response = future.get(5, TimeUnit.SECONDS)
            pendingQueries.remove(requestKey)
             return response.passwords
        } catch (_: Exception) {
            pendingQueries.remove(requestKey)
             return emptyList()
        }
    }

    /**
     * Gets the ciphertext for a specific password UUID
     */
    fun getCiphertext(userId: UUID, vaultId: UUID, passwordId: UUID): String? {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = CompletableFuture<CiphertextResponseDto>()
        val requestKey = "$vaultId:$passwordId"

        pendingCiphertexts[requestKey] = future

        // Send query to vault via STOMP
        val request = ExtractCiphertextRequestDto(
            passwordId = passwordId,
            vaultId = vaultId
        )

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/get-ciphertext",
            request
        )

        // Wait for response (with timeout) then remove from cache
        return try {
            val response = future.get(5, TimeUnit.SECONDS)
            pendingCiphertexts.remove(requestKey)
            response.ciphertext
        } catch (_: Exception) {
            pendingCiphertexts.remove(requestKey)
            null
        }
    }

    fun deletePassword(userId: UUID, vaultId: UUID, passwordId: UUID): DeletePasswordResponse? {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        val future = CompletableFuture<DeletePasswordResponse>()
        val requestKey = "$vaultId:$passwordId"

        pendingDeletions[requestKey] = future

        messagingTemplate.convertAndSendToUser(
            vaultId.toString(),
            "/vault/delete",
            DeletePasswordRequestDto(passwordId, vaultId)
        )

        return try {
            val response = future.get(5, TimeUnit.SECONDS)
            pendingDeletions.remove(requestKey)
            response
        } catch (_: Exception) {
            pendingDeletions.remove(requestKey)
            null
        }
    }

    /**
     * Handles the response for a password query from vault
     */
    fun handlePasswordQueryResponse(vaultId: UUID, response: PasswordQueryResponseDto) {
        val requestKey = "${vaultId}:${response.domain ?: "*"}"
        pendingQueries[requestKey]?.complete(response)
    }

    /**
     * Handles the response for ciphertext request from vault
     */
    fun handleCiphertextResponse(vaultId: UUID, response: CiphertextResponseDto) {
        val requestKey = "${vaultId}:${response.passwordId}"
        pendingCiphertexts[requestKey]?.complete(response)
    }

    /**
     * Handles the response for delete request from vault
     */
    fun handleDeleteResponse(vault: UUID, response: DeletePasswordResponse)
    {
        val requestKey = "${vault}:${response.passwordId}"
        pendingDeletions[requestKey]?.complete(response)
    }

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
    @Transactional
    fun handleSavePasswordAck(vaultId: UUID, ack: SavePasswordAckRequestDto) {
        when (ack.status) {
            SavePasswordAckStatus.ACK -> {
                val passwordId = ack.passwordId

                val vault = vaultRepository.findById(vaultId)
                    .getOrNull()

                if (vault == null) {
                    logger.warn("Received ACK for non-existing vaultId={}", vaultId)
                    return
                }

                if (passwordId == null) {
                    logger.warn("Received ACK for vaultId={}, but passwordId is null", vaultId)
                    return
                }

                vault.passwordCount += 1
                vaultRepository.save(vault)

                kafkaTemplate.send(
                    statisticsTopic,
                    PasswordStatisticEvent(
                        vaultId = vaultId,
                        passwordId = passwordId,
                        domain = ack.domain,
                        actionType = ActionType.ADDED,
                        userId = vault.ownerId
                    )
                )
            }

            SavePasswordAckStatus.NACK -> {
                logger.warn(
                    "Received NACK for vaultId={}, passwordId={}, reason={}",
                    vaultId,
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

        val response = passwordQueryService.deletePassword(userId, vaultId, passwordId)
            ?: throw VaultNotRespondedException("Vault $vaultId not responded to delete request for password $passwordId")

        kafkaTemplate.send(
            statisticsTopic,
            PasswordStatisticEvent(
                vaultId = vaultId,
                passwordId = passwordId,
                domain = response.domain,
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
