package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossyvault.dto.request.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossyvault.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class MetadataHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()
    private val handler = MetadataHandler(passwordEntryRepository, stompSessionRegistry)

    @Test
    fun `returns metadata with password id identifier domain and last change`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val lastModified = Instant.now()
        whenever(passwordEntryRepository.findByDomain("example.com")).thenReturn(
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

        handler.handleFrame(
            mock(),
            QueryPasswordsByDomainRequestDto(
                domain = "example.com",
                vaultId = vaultId
            )
        )

        val responseCaptor = argumentCaptor<PasswordQueryResponseDto>()
        verify(stompSessionRegistry, times(1)).send(
            eq("/app/vault/passwords-queried"),
            responseCaptor.capture()
        )

        val response = responseCaptor.firstValue
        assertEquals(vaultId, response.vaultId)
        assertEquals(1, response.passwords.size)
        assertEquals(passwordId, response.passwords.first().passwordId)
        assertEquals("john@example.com", response.passwords.first().identifier)
        assertEquals("example.com", response.passwords.first().domain)
        assertEquals(lastModified, response.passwords.first().lastModified)
    }

    @Test
    fun `null domain requests all passwords`() {
        val vaultId = UUID.randomUUID()
        whenever(passwordEntryRepository.findAll()).thenReturn(emptyList())

        handler.handleFrame(
            mock(),
            QueryPasswordsByDomainRequestDto(
                domain = null,
                vaultId = vaultId
            )
        )

        verify(passwordEntryRepository, times(1)).findAll()
        verify(stompSessionRegistry, times(1))
            .send(
                eq("/app/vault/passwords-queried"),
                any<PasswordQueryResponseDto>()
            )
    }
}
