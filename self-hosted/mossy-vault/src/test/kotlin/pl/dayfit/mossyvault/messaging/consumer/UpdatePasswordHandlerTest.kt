package pl.dayfit.mossyvault.messaging.consumer

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import pl.dayfit.mossyvault.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossyvault.service.PasswordEntryService
import java.util.UUID
import kotlin.io.encoding.Base64

class UpdatePasswordHandlerTest {

    private val passwordEntryService: PasswordEntryService = mock()
    private val handler = UpdatePasswordHandler(passwordEntryService)

    @Test
    fun `forwards update request to service`() {
        val passwordId = UUID.randomUUID()
        val request = UpdatePasswordRequestDto(
            passwordId = passwordId,
            identifier = "new-user",
            domain = "new.com",
            cipherText = Base64.encode("cipher-blob".toByteArray()),
            vaultId = UUID.randomUUID()
        )

        handler.handleFrame(mock(), request)

        verify(passwordEntryService, times(1)).update(request)
    }

    @Test
    fun `does not save when payload type is invalid`() {
        handler.handleFrame(mock(), "invalid")

        verify(passwordEntryService, never()).update(any())
    }
}
