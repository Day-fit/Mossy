package pl.dayfit.mossypassword.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.SimpMessagingTemplate
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.helper.VaultHelper
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID

class PasswordQueryServiceTest {

    private val messagingTemplate: SimpMessagingTemplate = mock()
    private val vaultHelper: VaultHelper = mock()

    private val service = PasswordQueryService(messagingTemplate, vaultHelper)

    @Test
    fun `query by domain throws when vault does not exist`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever { vaultHelper.requireOwnedConnectedVault(userId, vaultId) }
            .thenThrow(VaultNotFoundException::class.java)

        assertThrows<VaultNotFoundException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain throws when vault is offline`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever { vaultHelper.requireOwnedConnectedVault(userId, vaultId) }
            .thenThrow(VaultNotConnectedException::class.java)

        assertThrows<VaultNotConnectedException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `ciphertext query throws when vault is offline`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever { vaultHelper.requireOwnedConnectedVault(userId, vaultId) }
            .thenThrow(VaultNotConnectedException::class.java)

        assertThrows<VaultNotConnectedException> {
            service.getCiphertext(userId, vaultId, UUID.randomUUID())
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain sends request when vault is online`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever { vaultHelper.requireOwnedConnectedVault(userId, vaultId) }
            .thenReturn(
                Vault(
                    id = vaultId,
                    ownerId = userId,
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = true
                )
            )

        service.handlePasswordQueryResponse(
            PasswordQueryResponseDto(
                passwords = emptyList(),
                domain = "example.com",
                vaultId = vaultId
            )
        )
        service.getPasswordsMetadata(userId, vaultId, "example.com")

        verify(messagingTemplate).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/query-by-domain"), any())
    }

    @Test
    fun `query by domain throws when vault belongs to another user`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever { vaultHelper.requireOwnedConnectedVault(userId, vaultId) }
            .thenThrow(VaultAccessDeniedException::class.java)

        assertThrows<VaultAccessDeniedException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }
}