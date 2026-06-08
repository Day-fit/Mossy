package pl.dayfit.mossypassword.service

import messaging.response.VaultResponseMessageDto
import messaging.response.type.AbstractVaultResponseType
import messaging.response.type.SavePasswordResponseType
import type.VaultResponseStatus
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.helper.VaultHelper
import java.util.*
import java.util.concurrent.CompletableFuture

class VaultManagementServiceTest {

    private val vaultCommunicationService: VaultCommunicationService = mock()
    private val vaultHelper: VaultHelper = mock()

    private val service = VaultManagementService(vaultCommunicationService, vaultHelper)

    @Test
    @Suppress("UNCHECKED_CAST")
    fun `savePassword completes successfully`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto("john", "example.com", "cipher", vaultId)
        
        doNothing().whenever(vaultHelper).requireOwnedConnectedVault(userId, vaultId)
        
        val responseFuture = CompletableFuture.completedFuture(
            VaultResponseMessageDto(
                messageId = UUID.randomUUID(),
                status = VaultResponseStatus.OK,
                payload = SavePasswordResponseType()
            )
        )
        whenever(vaultCommunicationService.sendToVault(eq(vaultId), any())).thenReturn(responseFuture as CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>>)

        service.savePassword(userId, request)

        verify(vaultCommunicationService).sendToVault(eq(vaultId), any())
    }
}
