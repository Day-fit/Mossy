package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossyvault.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossyvault.dto.request.SavePasswordAckStatus
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.test.assertEquals

class SavePasswordHandlerTest {

    private val passwordEntryService: PasswordEntryService = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()

    private val handler = SavePasswordHandler(passwordEntryService, stompSessionRegistry)

    @Test
    fun `saves and sends ACK when payload is valid`() {
        whenever(stompSessionRegistry.send(any<String>(), any<Any>())).thenReturn(true)

        val passwordId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            vaultId = vaultId.toString(),
            passwordId = passwordId,
            messageId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryService, times(1)).saveOrUpdate(eq(request), any())

        val ackCaptor = argumentCaptor<Any>()
        verify(stompSessionRegistry, times(1)).send(eq("/app/vault/password-save-ack"), ackCaptor.capture())

        val ack = ackCaptor.firstValue as SavePasswordAckRequestDto
        assertEquals(SavePasswordAckStatus.ACK, ack.status)
        assertEquals(request.messageId, ack.messageId)
    }

    @Test
    fun `sends NACK when repository save fails`() {
        whenever(stompSessionRegistry.send(any<String>(), any<Any>())).thenReturn(true)
        whenever(passwordEntryService.saveOrUpdate(any(), any())).thenThrow(RuntimeException("db down"))

        val passwordId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            vaultId = vaultId.toString(),
            passwordId = passwordId,
            messageId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        val ackCaptor = argumentCaptor<Any>()
        verify(stompSessionRegistry, times(1)).send(eq("/app/vault/password-save-ack"), ackCaptor.capture())

        val ack = ackCaptor.firstValue as SavePasswordAckRequestDto
        assertEquals(SavePasswordAckStatus.NACK, ack.status)
        assertEquals(request.messageId, ack.messageId)
    }

    @Test
    fun `ignores invalid payload type`() {
        handler.handleFrame(mock(), "invalid")

        verify(passwordEntryService, never()).saveOrUpdate(any(), any())
        verify(stompSessionRegistry, never()).send(any<String>(), any<Any>())
    }

    @Test
    fun `ignores payload with invalid vault id`() {
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            vaultId = "not-a-uuid",
            passwordId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryService, never()).saveOrUpdate(any(), any())
        verify(stompSessionRegistry, never()).send(any<String>(), any<Any>())
    }

    @Test
    fun `save request without message id generates ack correlation id`() {
        whenever(stompSessionRegistry.send(any<String>(), any<Any>())).thenReturn(true)

        val vaultId = UUID.randomUUID().toString()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            vaultId = vaultId,
            passwordId = null
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryService, times(1)).saveOrUpdate(eq(request), any())

        val ackCaptor = argumentCaptor<Any>()
        verify(stompSessionRegistry).send(eq("/app/vault/password-save-ack"), ackCaptor.capture())
        val ack = ackCaptor.firstValue as SavePasswordAckRequestDto
        kotlin.test.assertNotNull(ack.messageId)
    }
}
