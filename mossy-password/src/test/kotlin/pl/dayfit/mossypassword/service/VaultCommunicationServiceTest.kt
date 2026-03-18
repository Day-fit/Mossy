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
import pl.dayfit.mossypassword.messaging.StatisticsEventPublisher
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
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
        val vaultId = UUID.randomUUID()
        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.empty())

        assertThrows<VaultNotFoundException> {
            service.savePassword(
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
            service.savePassword(
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
    fun `save returns deterministic id and sends request`() {
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

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        val firstId = service.savePassword(request)
        val secondId = service.savePassword(request)

        assertEquals(firstId, secondId)
        verify(messagingTemplate, times(2)).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/save"), any())
    }

    @Test
    fun `ack publishes statistics once and removes pending`() {
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

        val passwordId = service.savePassword(
            SavePasswordRequestDto(
                identifier = "john@example.com",
                domain = "example.com",
                cipherText = "QmFzZTY0Q2lwaGVy",
                vaultId = vaultId
            )
        )

        val ack = SavePasswordAckRequestDto(
            vaultId = vaultId,
            passwordId = passwordId,
            domain = "example.com",
            identifier = "john@example.com",
            status = SavePasswordAckStatus.ACK
        )

        service.handleSavePasswordAck(ack)
        service.handleSavePasswordAck(ack)

        val eventCaptor = argumentCaptor<pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent>()
        verify(statisticsEventPublisher, times(1)).publish(eventCaptor.capture())
        assertEquals(passwordId, eventCaptor.firstValue.passwordId)
        assertEquals(vaultId, eventCaptor.firstValue.vaultId)
        assertEquals("added", eventCaptor.firstValue.actionType)
    }

    @Test
    fun `nack triggers resend`() {
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

        val passwordId = service.savePassword(
            SavePasswordRequestDto(
                identifier = "john@example.com",
                domain = "example.com",
                cipherText = "QmFzZTY0Q2lwaGVy",
                vaultId = vaultId
            )
        )

        service.handleSavePasswordAck(
            SavePasswordAckRequestDto(
                vaultId = vaultId,
                passwordId = passwordId,
                domain = "example.com",
                identifier = "john@example.com",
                status = SavePasswordAckStatus.NACK,
                reason = "failed"
            )
        )

        verify(messagingTemplate, times(2)).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/save"), any())
        verify(statisticsEventPublisher, never()).publish(any())
    }
}
