package pl.dayfit.mossydevice.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossydevice.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.service.KeySyncService
import pl.dayfit.mossydevice.service.NonceService
import java.util.UUID
import kotlin.test.assertEquals

class KeySyncControllerTest {
    private val keySyncService: KeySyncService = mock()
    private val nonceService: NonceService = mock()
    private val controller = KeySyncController(keySyncService, nonceService)

    @Test
    fun `init key sync forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val deviceId = UUID.randomUUID()
        val request = InitKeySyncRequestDto(UUID.randomUUID())
        val serviceResponse = InitKeySyncResponseDto("123456")
        whenever(keySyncService.initKeySync(userId, deviceId, request.vaultId)).thenReturn(serviceResponse)

        val response = controller.initKeySync(jwtFor(userId), deviceId, request)

        assertEquals(serviceResponse, response.body)
        verify(keySyncService).initKeySync(userId, deviceId, request.vaultId)
    }

    @Test
    fun `get nonce forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val deviceId = UUID.randomUUID()
        whenever(nonceService.generateNonce(deviceId, userId)).thenReturn("nonce")

        val response = controller.getNonce(jwtFor(userId), deviceId)

        assertEquals("nonce", response.body?.nonce)
        verify(nonceService).generateNonce(deviceId, userId)
    }

    private fun jwtFor(userId: UUID): Jwt = mock<Jwt>().also {
        whenever(it.subject).thenReturn(userId.toString())
    }
}
