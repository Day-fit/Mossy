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
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.test.assertEquals

class SavePasswordHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()

    private val handler = SavePasswordHandler(passwordEntryRepository, stompSessionRegistry)

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
            passwordId = passwordId
        )

        handler.handleFrame(mock(), request)

        val entryCaptor = argumentCaptor<PasswordEntry>()
        verify(passwordEntryRepository, times(1)).save(entryCaptor.capture())
        assertEquals(passwordId, entryCaptor.firstValue.id)
        assertEquals("john@example.com", entryCaptor.firstValue.identifier)

        val ackCaptor = argumentCaptor<Any>()
        verify(stompSessionRegistry, times(1)).send(eq("/app/vault/password-save-ack"), ackCaptor.capture())

        val ack = ackCaptor.firstValue as SavePasswordAckRequestDto
        assertEquals(SavePasswordAckStatus.ACK, ack.status)
        assertEquals(passwordId, ack.passwordId)
        assertEquals(vaultId, ack.vaultId)
    }

    @Test
    fun `sends NACK when repository save fails`() {
        whenever(stompSessionRegistry.send(any<String>(), any<Any>())).thenReturn(true)
        whenever(passwordEntryRepository.save(any<PasswordEntry>())).thenThrow(RuntimeException("db down"))

        val passwordId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()

        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            vaultId = vaultId.toString(),
            passwordId = passwordId
        )

        handler.handleFrame(mock(), request)

        val ackCaptor = argumentCaptor<Any>()
        verify(stompSessionRegistry, times(1)).send(eq("/app/vault/password-save-ack"), ackCaptor.capture())

        val ack = ackCaptor.firstValue as SavePasswordAckRequestDto
        assertEquals(SavePasswordAckStatus.NACK, ack.status)
        assertEquals(passwordId, ack.passwordId)
        assertEquals(vaultId, ack.vaultId)
    }

    @Test
    fun `ignores invalid payload type`() {
        handler.handleFrame(mock(), "invalid")

        verify(passwordEntryRepository, never()).save(any<PasswordEntry>())
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

        verify(passwordEntryRepository, never()).save(any<PasswordEntry>())
        verify(stompSessionRegistry, never()).send(any<String>(), any<Any>())
    }

    @Test
    fun `deterministic id is stable when request password id is null`() {
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
        handler.handleFrame(mock(), request)

        val entryCaptor = argumentCaptor<PasswordEntry>()
        verify(passwordEntryRepository, times(2)).save(entryCaptor.capture())

        assertEquals(entryCaptor.firstValue.id, entryCaptor.secondValue.id)
    }
}
