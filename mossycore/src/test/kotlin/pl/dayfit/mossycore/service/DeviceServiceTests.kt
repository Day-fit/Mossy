package pl.dayfit.mossycore.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.junit.jupiter.MockitoExtension
import pl.dayfit.mossycore.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossycore.repository.UserDeviceRepository
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class DeviceServiceTests {
    private val repository: UserDeviceRepository = mock()
    private val deviceService = DeviceService(repository)

    @Test
    fun `test register device`() {

        deviceService.registerDevice(UUID.randomUUID(), RegisterDeviceRequestDto("publicKey"))
    }
}