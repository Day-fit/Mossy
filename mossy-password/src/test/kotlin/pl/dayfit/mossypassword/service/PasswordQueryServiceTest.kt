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
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.Optional
import java.util.UUID

class PasswordQueryServiceTest {

    private val messagingTemplate: SimpMessagingTemplate = mock()
    private val vaultRepository: VaultRepository = mock()

    private val service = PasswordQueryService(messagingTemplate, vaultRepository)

    @Test
    fun `query by domain throws when vault does not exist`() {
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.empty())

        assertThrows<VaultNotFoundException> {
            service.getPasswordUuidsByDomain(vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain throws when vault is offline`() {
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = UUID.randomUUID(),
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = false
                )
            )
        )

        assertThrows<VaultNotConnectedException> {
            service.getPasswordUuidsByDomain(vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `ciphertext query throws when vault is offline`() {
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = UUID.randomUUID(),
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = false
                )
            )
        )

        assertThrows<VaultNotConnectedException> {
            service.getCiphertext(vaultId, UUID.randomUUID())
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain sends request when vault is online`() {
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = UUID.randomUUID(),
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = true
                )
            )
        )

        Thread {
            Thread.sleep(20)
            service.handlePasswordQueryResponse(
                PasswordQueryResponseDto(
                    passwordIds = emptyList(),
                    domain = "example.com",
                    vaultId = vaultId
                )
            )
        }.start()

        service.getPasswordUuidsByDomain(vaultId, "example.com")

        verify(messagingTemplate).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/query-by-domain"), any())
    }
}
