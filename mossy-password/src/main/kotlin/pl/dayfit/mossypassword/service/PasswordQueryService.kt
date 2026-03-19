package pl.dayfit.mossypassword.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.response.PasswordMetadataDto
import pl.dayfit.mossypassword.dto.response.CiphertextResponseDto
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.messaging.dto.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

@Service
class PasswordQueryService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val vaultRepository: VaultRepository
) {

    private val pendingQueries: MutableMap<String, CompletableFuture<PasswordQueryResponseDto>> = ConcurrentHashMap()
    private val pendingCiphertexts: MutableMap<String, CompletableFuture<CiphertextResponseDto>> = ConcurrentHashMap()

    /**
     * Gets password metadata (without ciphertext) for a vault.
     */
    fun getPasswordsMetadata(userId: UUID, vaultId: UUID, domain: String?): List<PasswordMetadataDto> {
        requireOwnedConnectedVault(userId, vaultId)

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

        return try {
            val response = future.get(5, TimeUnit.SECONDS)
            pendingQueries.remove(requestKey)
            response.passwords
        } catch (e: Exception) {
            pendingQueries.remove(requestKey)
            emptyList()
        }
    }

    /**
     * Gets the ciphertext for a specific password UUID
     */
    fun getCiphertext(userId: UUID, vaultId: UUID, passwordId: UUID): String? {
        requireOwnedConnectedVault(userId, vaultId)

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
        } catch (e: Exception) {
            pendingCiphertexts.remove(requestKey)
            null
        }
    }

    /**
     * Handles the response for password query from vault
     */
    fun handlePasswordQueryResponse(response: PasswordQueryResponseDto) {
        val requestKey = "${response.vaultId}:${response.domain ?: "*"}"
        pendingQueries[requestKey]?.complete(response)
    }

    /**
     * Handles the response for ciphertext request from vault
     */
    fun handleCiphertextResponse(response: CiphertextResponseDto) {
        val requestKey = "${response.vaultId}:${response.passwordId}"
        pendingCiphertexts[requestKey]?.complete(response)
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
