package pl.dayfit.mossypassword.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossypassword.dto.request.VaultRegistrationRequestDto
import pl.dayfit.mossypassword.dto.request.VaultUpdateRequestDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.service.VaultAuthService
import pl.dayfit.mossypassword.service.VaultStatusService
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class VaultControllerTest {
    private val vaultAuthService: VaultAuthService = mock()
    private val vaultStatusService: VaultStatusService = mock()
    private val controller = VaultController(vaultAuthService, vaultStatusService)

    @Test
    fun `register forwards request and returns payload`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = VaultRegistrationRequestDto("Primary")
        val responseDto = VaultRegistrationResponseDto(vaultId, "api-key")
        whenever(vaultAuthService.register(userId, request)).thenReturn(responseDto)

        val response = controller.register(userId, request)

        assertEquals(200, response.statusCode.value())
        assertEquals(responseDto, response.body)
        verify(vaultAuthService, times(1)).register(userId, request)
    }

    @Test
    fun `getVaults returns statuses`() {
        val userId = UUID.randomUUID()
        val statuses = listOf(
            VaultStatusResponseDto(UUID.randomUUID(), "Primary", true, Instant.now(), 0)
        )
        whenever(vaultStatusService.getVaultsStatuses(userId)).thenReturn(statuses)

        val response = controller.getVaults(userId)

        assertEquals(200, response.statusCode.value())
        assertEquals(statuses, response.body)
    }

    @Test
    fun `deleteVault delegates to service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val responseDto = ServerResponseDto("Vault deleted successfully")
        whenever(vaultAuthService.delete(userId, vaultId)).thenReturn(responseDto)

        val response = controller.deleteVault(userId, vaultId)

        assertEquals(200, response.statusCode.value())
        assertEquals(responseDto, response.body)
        verify(vaultAuthService, times(1)).delete(userId, vaultId)
    }

    @Test
    fun `updateVault delegates to service`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = VaultUpdateRequestDto("Renamed")
        val responseDto = ServerResponseDto("Vault updated successfully")
        whenever(vaultAuthService.update(userId, vaultId, request)).thenReturn(responseDto)

        val response = controller.updateVault(userId, vaultId, request)

        assertEquals(200, response.statusCode.value())
        assertEquals(responseDto, response.body)
        verify(vaultAuthService, times(1)).update(userId, vaultId, request)
    }
}
