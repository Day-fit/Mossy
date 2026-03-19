package pl.dayfit.mossypassword.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.SimpMessagingTemplate
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordAckStatus
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordVaultRequestDto
import pl.dayfit.mossypassword.messaging.StatisticsEventPublisher
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class VaultCommunicationServiceTest {

    private val messagingTemplate: SimpMessagingTemplate = mock()
    private val statisticsEventPublisher: StatisticsEventPublisher = mock()
    private val vaultRepository: VaultRepository = mock()

    private val service = VaultCommunicationService(
        messagingTemplate,
        statisticsEventPublisher,
        vaultRepository
    )

    @Test
    fun `save throws when vault is missing`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.empty())

        assertThrows<VaultNotFoundException> {
            service.savePassword(
                userId,
                SavePasswordRequestDto(
                    identifier = "john@example.com",
                    domain = "example.com",
                    cipherText = "QmFzZTY0Q2lwaGVy",
                    vaultId = vaultId
                )
            )
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `save throws when vault is offline`() {
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
            service.savePassword(
                userId,
                SavePasswordRequestDto(
                    identifier = "john@example.com",
                    domain = "example.com",
                    cipherText = "QmFzZTY0Q2lwaGVy",
                    vaultId = vaultId
                )
            )
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }

    @Test
    fun `save sends vault request without user-provided ids`() {
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

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        service.savePassword(userId, request)

        val payloadCaptor = argumentCaptor<SavePasswordVaultRequestDto>()
        verify(messagingTemplate).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/save"), payloadCaptor.capture())
        assertEquals(request.identifier, payloadCaptor.firstValue.identifier)
        assertEquals(request.domain, payloadCaptor.firstValue.domain)
        assertEquals(request.cipherText, payloadCaptor.firstValue.cipherText)
        assertEquals(request.vaultId, payloadCaptor.firstValue.vaultId)
    }

    @Test
    fun `ack publishes added statistics event`() {
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

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        service.savePassword(userId, request)

        val ackPasswordId = UUID.randomUUID()

        service.handleSavePasswordAck(
            SavePasswordAckRequestDto(
                vaultId = vaultId,
                passwordId = ackPasswordId,
                domain = "example.com",
                status = SavePasswordAckStatus.ACK
            )
        )

        val eventCaptor = argumentCaptor<pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent>()
        verify(statisticsEventPublisher, times(1)).publish(eventCaptor.capture())
        assertEquals(vaultId, eventCaptor.firstValue.vaultId)
        assertEquals(ackPasswordId, eventCaptor.firstValue.passwordId)
        assertEquals("example.com", eventCaptor.firstValue.domain)
        assertEquals("added", eventCaptor.firstValue.actionType)
    }

    @Test
    fun `nack does not publish statistics`() {
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

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        service.savePassword(userId, request)

        service.handleSavePasswordAck(
            SavePasswordAckRequestDto(
                vaultId = vaultId,
                passwordId = null,
                domain = "example.com",
                status = SavePasswordAckStatus.NACK
            )
        )

        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/save"), any())
        verify(statisticsEventPublisher, never()).publish(any())
    }

    @Test
    fun `save throws when vault belongs to different user`() {
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
            service.savePassword(
                userId,
                SavePasswordRequestDto(
                    identifier = "john@example.com",
                    domain = "example.com",
                    cipherText = "QmFzZTY0Q2lwaGVy",
                    vaultId = vaultId
                )
            )
        }

        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any())
    }
}
