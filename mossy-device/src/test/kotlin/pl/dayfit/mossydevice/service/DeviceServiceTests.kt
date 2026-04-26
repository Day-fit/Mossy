package pl.dayfit.mossydevice.service

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
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

@ExtendWith(MockitoExtension::class)
class DeviceServiceTests {
    private val deviceRepository: UserDeviceRepository = mock()
    private val deviceService = DeviceService(deviceRepository)

    @Test
    fun `test register device when no device approved does not require approval`() {
        whenever(
            deviceRepository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(false)

        val userId = UUID.randomUUID()
        val deviceId = UUID.randomUUID()

        val pkId = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()

        whenever(
            deviceRepository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                userId,
                pkId,
                true,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            UUID.randomUUID(),
            RegisterDeviceRequestDto(
                pkId.toJSONObject()
            )
        )

        Assertions.assertTrue {
            result.deviceId == deviceId && !result.requiresSync
        }
    }

    @Test
    fun `test register device when device approved requires approval`() {
        whenever(
            deviceRepository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(true)

        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        val pkId = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()

        whenever(
            deviceRepository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                userId,
                pkId,
                false,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            userId,
            RegisterDeviceRequestDto(
                pkId.toJSONObject()
            )
        )

        Assertions.assertTrue {
            result.deviceId == deviceId && result.requiresSync
        }
    }
}
