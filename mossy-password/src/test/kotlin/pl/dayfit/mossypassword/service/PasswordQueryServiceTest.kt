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
import pl.dayfit.mossypassword.dto.response.PasswordMetadataDto
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.time.Instant
import java.util.Optional
import java.util.UUID

class PasswordQueryServiceTest {

    private val messagingTemplate: SimpMessagingTemplate = mock()
    private val vaultRepository: VaultRepository = mock()

    private val service = PasswordQueryService(messagingTemplate, vaultRepository)

    @Test
    fun `query by domain throws when vault does not exist`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.empty())

        assertThrows<VaultNotFoundException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain throws when vault is offline`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = userId,
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = false
                )
            )
        )

        assertThrows<VaultNotConnectedException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `ciphertext query throws when vault is offline`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = userId,
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = false
                )
            )
        )

        assertThrows<VaultNotConnectedException> {
            service.getCiphertext(userId, vaultId, UUID.randomUUID())
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `query by domain sends request when vault is online`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = userId,
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
                    passwords = emptyList(),
                    domain = "example.com",
                    vaultId = vaultId
                )
            )
        }.start()

        service.getPasswordsMetadata(userId, vaultId, "example.com")

        verify(messagingTemplate).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/query-by-domain"), any())
    }

    @Test
    fun `query by domain returns password metadata without ciphertext`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(
            Optional.of(
                Vault(
                    id = vaultId,
                    ownerId = userId,
                    name = "Vault",
                    secretHash = "hash",
                    isOnline = true
                )
            )
        )

        val metadata = PasswordMetadataDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            domain = "example.com",
            lastModified = Instant.now()
        )

        Thread {
            Thread.sleep(20)
            service.handlePasswordQueryResponse(
                PasswordQueryResponseDto(
                    passwords = listOf(metadata),
                    domain = "example.com",
                    vaultId = vaultId
                )
            )
        }.start()

        val result = service.getPasswordsMetadata(userId, vaultId, "example.com")

        kotlin.test.assertEquals(listOf(metadata), result)
    }

    @Test
    fun `query by domain throws when vault belongs to another user`() {
        val userId = UUID.randomUUID()
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

        assertThrows<VaultAccessDeniedException> {
            service.getPasswordsMetadata(userId, vaultId, "example.com")
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }
}
