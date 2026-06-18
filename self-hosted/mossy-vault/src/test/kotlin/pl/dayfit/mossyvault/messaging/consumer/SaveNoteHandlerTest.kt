package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.SaveNoteRequestType
import messaging.response.VaultResponseMessageDto
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.stomp.StompHeaders
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.exception.VaultRequestValidationFailedException
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import messaging.response.type.VaultResponseType
import type.VaultResponseStatus
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@OptIn(ExperimentalEncodingApi::class)
class SaveNoteHandlerTest {
    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()
    private val handler = SaveNoteHandler(passwordEntryRepository, stompSessionRegistry)

    @Test
    fun `sends save-note ack with request messageId`() {
        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val note = Base64.encode("note".toByteArray())
        val entry = PasswordEntry(
            id = passwordId,
            identifier = "john@example.com",
            encryptedBlob = byteArrayOf(1, 2, 3),
            address = "example.com",
            lastModified = Instant.now()
        )
        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = SaveNoteRequestType(passwordId, note)
        )

        whenever(passwordEntryRepository.findById(passwordId)).thenReturn(Optional.of(entry))

        handler.handleFrame(StompHeaders(), request)

        verify(passwordEntryRepository, times(1)).save(entry)
        assertEquals("note", entry.note?.content?.toString(Charsets.UTF_8))

        val responseCaptor = argumentCaptor<VaultResponseMessageDto<*>>()
        verify(stompSessionRegistry, times(1)).send(
            eq(StompEndpoints.USER_NOTE_SAVED),
            responseCaptor.capture()
        )

        val response = responseCaptor.firstValue
        assertEquals(VaultResponseStatus.OK, response.status)
        assertEquals(request.messageId, response.messageId)
    }

    @Test
    fun `ignores invalid payload type`() {
        assertFailsWith<VaultRequestValidationFailedException> {
            handler.handleFrame(StompHeaders(), "invalid")
        }

        verify(passwordEntryRepository, times(0)).save(any())
        verify(stompSessionRegistry, times(0)).send(any<String>(), any<VaultResponseMessageDto<VaultResponseType>>())
    }
}
