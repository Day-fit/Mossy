package pl.dayfit.mossypassword.controller

import messaging.request.PasswordMetadataDto
import messaging.response.type.CiphertextResponseType
import messaging.response.type.MetadataResponseType
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.service.VaultManagementService
import pl.dayfit.mossypassword.exception.VaultNotFoundException
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class PasswordControllerMvcTest {

    private val vaultManagementService: VaultManagementService = mock()
    private val controller = PasswordController(vaultManagementService)

    @Test
    fun `save endpoint forwards payload and returns accepted response`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        val response = controller.savePassword(userId, request)
        val body = response.body

        assertEquals(200, response.statusCode.value())
        assertNotNull(body)
        assertEquals(ServerResponseDto("Password save request accepted"), body)
        verify(vaultManagementService, times(1)).savePassword(userId, request)
    }

    @Test
    fun `save endpoint propagates exception`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        whenever(vaultManagementService.savePassword(userId, request)).thenThrow(VaultNotFoundException(vaultId))

        assertThrows<VaultNotFoundException> {
            controller.savePassword(userId, request)
        }
    }

    @Test
    fun `update endpoint forwards request to service`() {
        val userId = UUID.randomUUID()
        val request = UpdatePasswordRequestDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = UUID.randomUUID()
        )

        val response = controller.updatePassword(userId, request)

        assertEquals(200, response.statusCode.value())
        assertEquals("Password updated successfully", response.body?.message)
        verify(vaultManagementService, times(1)).updatePassword(userId, request)
    }

    @Test
    fun `delete endpoint forwards request to service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val request = DeletePasswordRequestDto(passwordId, vaultId)

        val response = controller.deletePassword(userId, request)

        assertEquals(200, response.statusCode.value())
        assertEquals("Password deleted successfully", response.body?.message)
        verify(vaultManagementService, times(1)).deletePassword(userId, request)
    }

    @Test
    fun `get metadata endpoint returns values from management service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val first = PasswordMetadataDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            domain = "example.com",
            lastModified = Instant.now()
        )
        val second = PasswordMetadataDto(
            passwordId = UUID.randomUUID(),
            identifier = "anna@example.com",
            domain = "example.com",
            lastModified = Instant.now()
        )

        whenever(vaultManagementService.getPasswordsMetadata(userId, vaultId))
            .thenReturn(
                CompletableFuture.completedFuture(MetadataResponseType(listOf(first, second)))
            )

        val response = controller.getPasswordsMetadata(userId, vaultId)

        assertEquals(200, response.get().statusCode.value())
        assertEquals(listOf(first, second), response.get().body)
        verify(vaultManagementService, times(1)).getPasswordsMetadata(userId, vaultId)
    }

    @Test
    fun `get ciphertext endpoint returns body when service returns ciphertext`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        
        val expectedResponse = CompletableFuture.completedFuture(CiphertextResponseType("BASE64", passwordId))

        whenever(vaultManagementService.getPasswordCipherText(userId, vaultId, passwordId))
            .thenReturn(expectedResponse)

        val response = controller.getCiphertext(userId, passwordId, vaultId)

        assertEquals(200, response.get().statusCode.value())
        assertEquals(expectedResponse.get(), response.get().body)
        verify(vaultManagementService, times(1)).getPasswordCipherText(userId, vaultId, passwordId)
    }
}
