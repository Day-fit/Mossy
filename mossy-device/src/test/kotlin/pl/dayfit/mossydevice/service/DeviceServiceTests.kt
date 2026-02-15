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
import java.security.SecureRandom
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class DeviceServiceTests {
    private val repository: UserDeviceRepository = mock()
    private val deviceService = DeviceService(repository, SecureRandom())

    @Test
    fun `test register device when no device approved does not require approval`() {
        whenever(
            repository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(false)

        val userId = UUID.randomUUID()
        val deviceId = UUID.randomUUID()

        val pkId = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()

        val pkDH = OctetKeyPairGenerator(Curve.X25519)
            .generate()
            .toPublicJWK()

        whenever(
            repository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                userId,
                pkDH,
                pkId,
                true,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            UUID.randomUUID(),
            RegisterDeviceRequestDto(
                pkDH.toJSONObject(),
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
            repository.existsUserDevicesByUserIdAndApproved(
                any<UUID>(),
                any<Boolean>()
            )
        ).thenReturn(true)

        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        val pkId = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()

        val pkDH = OctetKeyPairGenerator(Curve.X25519)
            .generate()
            .toPublicJWK()

        whenever(
            repository.save(any<UserDevice>())
        ).thenReturn(
            UserDevice(
                deviceId,
                userId,
                pkDH,
                pkId,
                false,
                null
            )
        )

        val result: RegisterDeviceResponseDto = deviceService.registerDevice(
            userId,
            RegisterDeviceRequestDto(
                pkDH.toJSONObject(),
                pkId.toJSONObject()
            )
        )

        Assertions.assertTrue {
            result.deviceId == deviceId && result.requiresSync
        }
    }
}