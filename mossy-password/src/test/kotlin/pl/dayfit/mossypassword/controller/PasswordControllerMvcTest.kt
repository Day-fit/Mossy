package pl.dayfit.mossypassword.controller

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.response.SavePasswordAcceptedResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService
import pl.dayfit.mossypassword.service.VaultCommunicationService
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class PasswordControllerMvcTest {

    private val vaultCommunicationService: VaultCommunicationService = org.mockito.kotlin.mock()
    private val passwordQueryService: PasswordQueryService = org.mockito.kotlin.mock()
    private val controller = PasswordController(vaultCommunicationService, passwordQueryService)

    @Test
    fun `save endpoint forwards payload and returns accepted response`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        whenever(vaultCommunicationService.savePassword(userId, request)).thenReturn(passwordId)

        val response = controller.savePassword(userId, request)
        val body = response.body

        assertEquals(200, response.statusCode.value())
        assertNotNull(body)
        assertEquals(SavePasswordAcceptedResponseDto(passwordId, "Password save request accepted"), body)
        verify(vaultCommunicationService, times(1)).savePassword(userId, request)
    }

    @Test
    fun `save endpoint propagates offline exception`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        whenever(vaultCommunicationService.savePassword(userId, request)).thenThrow(VaultNotConnectedException(vaultId))

        assertThrows<VaultNotConnectedException> {
            controller.savePassword(userId, request)
        }
    }

    @Test
    fun `save endpoint propagates missing vault exception`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId
        )

        whenever(vaultCommunicationService.savePassword(userId, request)).thenThrow(VaultNotFoundException(vaultId))

        assertThrows<VaultNotFoundException> {
            controller.savePassword(userId, request)
        }
    }

    @Test
    fun `extract ciphertext endpoint forwards request to service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val request = ExtractCiphertextRequestDto(passwordId, vaultId)

        val response = controller.extractCiphertext(userId, request)

        assertEquals(200, response.statusCode.value())
        assertEquals("Ciphertext extraction requested successfully", response.body?.message)

        verify(vaultCommunicationService, times(1)).extractCiphertext(userId, vaultId, passwordId)
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
        verify(vaultCommunicationService, times(1)).updatePassword(userId, request)
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
        verify(vaultCommunicationService, times(1)).deletePassword(userId, vaultId, passwordId)
    }

    @Test
    fun `get uuids endpoint returns values from query service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val first = UUID.randomUUID()
        val second = UUID.randomUUID()

        whenever(passwordQueryService.getPasswordUuidsByDomain(userId, vaultId, "example.com"))
            .thenReturn(listOf(first, second))

        val response = controller.getPasswordUuidsByDomain(userId, "example.com", vaultId.toString())

        assertEquals(200, response.statusCode.value())
        assertEquals(listOf(first, second), response.body)
    }

    @Test
    fun `get ciphertext endpoint returns 404 when service returns null`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()

        whenever(passwordQueryService.getCiphertext(userId, vaultId, passwordId)).thenReturn(null)

        val response = controller.getCiphertext(userId, passwordId, vaultId.toString())

        assertEquals(404, response.statusCode.value())
        assertNull(response.body)
    }

    @Test
    fun `get ciphertext endpoint returns body when service returns ciphertext`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()

        whenever(passwordQueryService.getCiphertext(userId, vaultId, passwordId)).thenReturn("BASE64")

        val response = controller.getCiphertext(userId, passwordId, vaultId.toString())

        assertEquals(200, response.statusCode.value())
        assertEquals("BASE64", response.body?.get("ciphertext"))
    }
}
