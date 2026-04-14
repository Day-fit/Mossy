package pl.dayfit.mossyvault.messaging.consumer

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.MetadataRequestType
import messaging.response.type.MetadataResponseType
import type.VaultResponseStatus
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.messaging.simp.stomp.StompHeaders
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import pl.dayfit.mossyvault.model.PasswordEntry

class MetadataHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()
    private val handler = MetadataHandler(passwordEntryRepository, stompSessionRegistry)

    @Test
    fun `returns metadata of all passwords`() {
        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val lastModified = Instant.now()
        
        whenever(passwordEntryRepository.findAll()).thenReturn(
            listOf(
                PasswordEntry(
                    id = passwordId,
                    identifier = "john@example.com",
                    encryptedBlob = byteArrayOf(1, 2, 3),
                    domain = "example.com",
                    lastModified = lastModified
                )
            )
        )

        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = MetadataRequestType()
        )

        handler.handleFrame(StompHeaders(), request)

        val responseCaptor = argumentCaptor<VaultResponseMessageDto<MetadataResponseType>>()
        verify(stompSessionRegistry, times(1)).send(
            eq(StompEndpoints.USER_PASSWORDS_QUERIED),
            responseCaptor.capture()
        )

        val response = responseCaptor.firstValue
        assertEquals(VaultResponseStatus.OK, response.status)
        assertEquals(correlationId, response.messageId)
        
        val payload = response.payload
        assertEquals(1, payload.metadata.size)
        assertEquals(passwordId, payload.metadata.first().passwordId)
        assertEquals("john@example.com", payload.metadata.first().identifier)
        assertEquals("example.com", payload.metadata.first().domain)
        assertEquals(lastModified, payload.metadata.first().lastModified)
    }

    @Test
    fun `ignores invalid payload type`() {
        handler.handleFrame(StompHeaders(), "invalid")

        verify(passwordEntryRepository, never()).findAll()
        verify(stompSessionRegistry, never()).send(any<String>(), any<Any>())
    }
}
