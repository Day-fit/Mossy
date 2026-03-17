package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossyvault.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ExtractCiphertextHandlerTest {

    private val passwordEntryRepository: PasswordEntryRepository = mock()
    private val handler = ExtractCiphertextHandler(passwordEntryRepository)

    @Test
    fun `looks up entry when payload is valid`() {
        val passwordId = UUID.randomUUID()
        val entry = PasswordEntry(
            id = passwordId,
            identifier = "user",
            encryptedBlob = "cipher-blob".toByteArray(),
            domain = "example.com",
            lastModified = Instant.now()
        )
        whenever(passwordEntryRepository.findById(passwordId)).thenReturn(Optional.of(entry))

        val request = ExtractCiphertextRequestDto(
            passwordId = passwordId,
            vaultId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryRepository, times(1)).findById(passwordId)
    }

    @Test
    fun `does not call repository when payload type is invalid`() {
        handler.handleFrame(mock(), "invalid")

        verify(passwordEntryRepository, never()).findById(any())
    }
}
