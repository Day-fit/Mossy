package pl.dayfit.mossypassword.service

import messaging.request.type.SavePasswordRequestType
import messaging.response.type.SavePasswordResponseType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import type.PasswordSaveType
import type.PasswordType
import java.util.*
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals

class PasswordManagementServiceTest {

    private val vaultCommunicationService: VaultCommunicationService = mock()
    private val service = PasswordManagementService(vaultCommunicationService)

    @Test
    fun `savePassword completes successfully`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto("john", "example.com", "cipher", vaultId, PasswordType.PASSWORD)

        whenever(
            vaultCommunicationService.handleProcessing<SavePasswordResponseType>(
                eq(userId),
                eq(vaultId),
                any()
            )
        ).thenReturn(
            CompletableFuture.completedFuture(SavePasswordResponseType())
        )

        service.savePassword(userId, request)

        val payloadCaptor = argumentCaptor<SavePasswordRequestType>()
        verify(vaultCommunicationService).handleProcessing<SavePasswordResponseType>(
            eq(userId),
            eq(vaultId),
            payloadCaptor.capture()
        )

        val payload = payloadCaptor.firstValue
        assertEquals("john", payload.identifier)
        assertEquals("example.com", payload.address)
        assertEquals("cipher", payload.cipherText)
        assertEquals(PasswordSaveType.SAVE, payload.saveType)
    }
}
