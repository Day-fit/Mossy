package pl.dayfit.mossydevice.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossydevice.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.service.KeySyncService
import java.util.UUID
import kotlin.test.assertEquals

class KeySyncControllerTest {
    private val keySyncService: KeySyncService = mock()
    private val controller = KeySyncController(keySyncService)

    @Test
    fun `init key sync forwards JWT subject as user id`() {
        val userId = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val deviceId = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val request = InitKeySyncRequestDto(
            UUID.fromString("30000000-0000-0000-0000-000000000001")
        )
        val serviceResponse = InitKeySyncResponseDto("123456")
        whenever(keySyncService.initKeySync(userId, deviceId, request.vaultId)).thenReturn(serviceResponse)

        val response = controller.initKeySync(jwtFor(userId, deviceId), request)

        assertEquals(serviceResponse, response.body)
        verify(keySyncService).initKeySync(userId, deviceId, request.vaultId)
    }

    private fun jwtFor(userId: UUID, deviceId: UUID): Jwt = mock<Jwt>().also {
        whenever(it.subject).thenReturn(userId.toString())
        whenever(it.getClaimAsString("device_id")).thenReturn(deviceId.toString())
    }
}
