package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossyvault.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.test.assertEquals

class UpdatePasswordHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val handler = UpdatePasswordHandler(passwordEntryRepository)

    @Test
    fun `updates existing password entry`() {
        val passwordId = UUID.randomUUID()
        val existingEntry = PasswordEntry(
            id = passwordId,
            identifier = "old-user",
            encryptedBlob = byteArrayOf(1, 2, 3),
            domain = "old.com",
            lastModified = Instant.now().minusSeconds(120)
        )

        whenever(passwordEntryRepository.findById(passwordId)).thenReturn(Optional.of(existingEntry))

        val request = UpdatePasswordRequestDto(
            passwordId = passwordId,
            identifier = "new-user",
            domain = "new.com",
            cipherText = Base64.encode("cipher-blob".toByteArray()),
            vaultId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        assertEquals("new-user", existingEntry.identifier)
        assertEquals("new.com", existingEntry.domain)
        assertEquals("cipher-blob", existingEntry.encryptedBlob.decodeToString())
        verify(passwordEntryRepository, times(1)).save(existingEntry)
    }

    @Test
    fun `does not save when payload type is invalid`() {
        handler.handleFrame(mock(), "invalid")

        verify(passwordEntryRepository, never()).findById(any())
        verify(passwordEntryRepository, never()).save(any())
    }

    @Test
    fun `does not save when entry does not exist`() {
        val passwordId = UUID.randomUUID()
        whenever(passwordEntryRepository.findById(passwordId)).thenReturn(Optional.empty())

        val request = UpdatePasswordRequestDto(
            passwordId = passwordId,
            identifier = "new-user",
            domain = "new.com",
            cipherText = Base64.encode("cipher-blob".toByteArray()),
            vaultId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryRepository, times(1)).findById(passwordId)
        verify(passwordEntryRepository, never()).save(any())
    }
}
