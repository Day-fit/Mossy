package pl.dayfit.mossyvault.service

import messaging.request.type.SavePasswordRequestType
import messaging.request.type.UpdatePasswordRequestType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import type.PasswordType
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class PasswordEntryServiceTest {

    private val passwordEntryRepository: PasswordEntryRepository = org.mockito.kotlin.mock()
    private val service = PasswordEntryService(passwordEntryRepository)

    @Test
    fun `save creates new password entry with requested type`() {
        val passwordId = UUID.randomUUID()
        val decodedBlob = "cipher".toByteArray()
        val request = SavePasswordRequestType(
            identifier = "john@example.com",
            address = "example.com",
            cipherText = "unused",
            passwordType = PasswordType.SSH_KEY
        )

        whenever(passwordEntryRepository.save(any<PasswordEntry>())).thenAnswer {
            it.getArgument<PasswordEntry>(0).apply { id = passwordId }
        }

        val result = service.save(request, decodedBlob)

        assertEquals(passwordId, result)
        verify(passwordEntryRepository).save(
            org.mockito.kotlin.check {
                assertEquals("john@example.com", it.identifier)
                assertEquals("example.com", it.address)
                assertEquals(PasswordType.SSH_KEY, it.passwordType)
                assertContentEquals(decodedBlob, it.encryptedBlob)
            }
        )
    }

    @Test
    fun `update changes existing password data without changing type`() {
        val passwordId = UUID.randomUUID()
        val originalType = PasswordType.SSH_KEY
        val decodedBlob = "new-cipher".toByteArray()
        val entry = PasswordEntry(
            id = passwordId,
            identifier = "old",
            address = "old.example.com",
            passwordType = originalType,
            encryptedBlob = "old-cipher".toByteArray(),
            lastModified = Instant.EPOCH
        )
        val request = UpdatePasswordRequestType(
            passwordId = passwordId,
            identifier = "new",
            address = "new.example.com",
            cipherText = "unused"
        )

        whenever(passwordEntryRepository.findById(passwordId)).thenReturn(Optional.of(entry))
        whenever(passwordEntryRepository.save(any<PasswordEntry>())).thenAnswer { it.getArgument<PasswordEntry>(0) }

        val result = service.update(request, decodedBlob)

        assertEquals(passwordId, result)
        assertEquals("new", entry.identifier)
        assertEquals("new.example.com", entry.address)
        assertEquals(originalType, entry.passwordType)
        assertContentEquals(decodedBlob, entry.encryptedBlob)
        verify(passwordEntryRepository).save(eq(entry))
    }

}
