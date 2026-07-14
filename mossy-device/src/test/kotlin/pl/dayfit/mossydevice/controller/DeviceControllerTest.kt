package pl.dayfit.mossydevice.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.service.DeviceService
import java.util.UUID
import kotlin.test.assertEquals

class DeviceControllerTest {
    private val deviceService: DeviceService = mock()
    private val controller = DeviceController(deviceService)

    @Test
    fun `register device forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val request = RegisterDeviceRequestDto(emptyMap())
        val serviceResponse = RegisterDeviceResponseDto(UUID.randomUUID(), false)
        whenever(deviceService.registerDevice(userId, request)).thenReturn(serviceResponse)

        val response = controller.registerDevice(jwtFor(userId), request)

        assertEquals(serviceResponse, response.body)
        verify(deviceService).registerDevice(userId, request)
    }

    private fun jwtFor(userId: UUID): Jwt = mock<Jwt>().also {
        whenever(it.subject).thenReturn(userId.toString())
    }
}
