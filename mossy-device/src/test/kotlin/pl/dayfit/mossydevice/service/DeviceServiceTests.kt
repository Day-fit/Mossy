package pl.dayfit.mossydevice.service

import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.model.UserDevice
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import java.util.UUID
import kotlin.io.encoding.Base64

@ExtendWith(MockitoExtension::class)
class DeviceServiceTests {
    private val repository: UserDeviceRepository = mock()
    private val deviceService = DeviceService(repository)

    @Test
    fun `test register device when no device approved does not require approval`() {
        whenever(
            repository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(false)

        val deviceId = UUID.randomUUID()

        whenever(
            repository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                UUID.randomUUID(),
                ByteArray(0),
                true,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            UUID.randomUUID(),
            RegisterDeviceRequestDto(
                Base64.encode(ByteArray(0))
            )
        )

        Assertions.assertTrue {
            result.deviceId == deviceId && !result.requiredApproval
        }
    }

    @Test
    fun `test register device when device approved requires approval`() {
        whenever(
            repository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(true)

        val deviceId = UUID.randomUUID()

        whenever(
            repository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                UUID.randomUUID(),
                ByteArray(0),
                true,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            UUID.randomUUID(),
            RegisterDeviceRequestDto(
                Base64.encode(ByteArray(0))
            )
        )

        Assertions.assertTrue {
            result.deviceId == deviceId && result.requiredApproval
        }
    }
}