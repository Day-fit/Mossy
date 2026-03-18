package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import org.springframework.messaging.simp.SimpMessagingTemplate
import pl.dayfit.mossyvault.dto.request.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossyvault.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class QueryPasswordsByDomainHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val messagingTemplate: SimpMessagingTemplate = mock()
    private val messagingTemplateProvider: ObjectProvider<SimpMessagingTemplate> = mock()
    private val handler = QueryPasswordsByDomainHandler(passwordEntryRepository, messagingTemplateProvider)

    @Test
    fun `returns metadata with password id identifier domain and last change`() {
        whenever(messagingTemplateProvider.getIfAvailable()).thenReturn(messagingTemplate)
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
        verify(messagingTemplate, times(1)).convertAndSendToUser(
            eq(vaultId.toString()),
            eq("/vault/passwords-queried"),
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
        whenever(messagingTemplateProvider.getIfAvailable()).thenReturn(messagingTemplate)
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
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(vaultId.toString()), eq("/vault/passwords-queried"), any())
    }
}
