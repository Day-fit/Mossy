package pl.dayfit.mossydevicetrust.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException
import pl.dayfit.mossydevicetrust.helper.KeygenHelper.generateKeyPair
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import java.security.InvalidKeyException
import java.time.Instant
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class DeviceInfoServiceTest {
    @Mock
    lateinit var deviceInfoRepository: DeviceInfoRepository

    @InjectMocks
    lateinit var deviceInfoService: DeviceInfoService

    @Test
    fun `saves device info with same key as provided`() {
        val publicJwk = generateKeyPair()
            .toPublicJWK()

        assert(!publicJwk.isPrivate)

        val request = RegisterDeviceRequestDto(
            UUID.randomUUID(),
            "Windows",
            "eb:05:fb:e3:2a:63",
            publicJwk.toJSONObject()
        )

        whenever(deviceInfoRepository.save(any<DeviceInfo>()))
            .thenReturn(
                DeviceInfo(
                    id = UUID.randomUUID(),
                    userId = UUID.randomUUID(),
                    publicJwk,
                    "Android"
                )
            )

        deviceInfoService.registerDevice(request)

        verify(deviceInfoRepository).save(
            argThat { deviceInfo ->
                deviceInfo.publicIdentityKey == publicJwk
            }
        )
    }

    @Test
    fun `fails if provided key is not public key`() {
        val jwk = generateKeyPair()
        assert(jwk.isPrivate)

        val request = RegisterDeviceRequestDto(
            UUID.randomUUID(),
            "Windows",
            "eb:05:fb:e3:2a:63",
            jwk.toJSONObject()
        )

        assertThrows<InvalidKeyException> { deviceInfoService.registerDevice(request) }
    }

    @Test
    fun `fails if key is invalid`() {
        val request = RegisterDeviceRequestDto(
            UUID.randomUUID(),
            "Windows",
            "eb:05:fb:e3:2a:63",
            mapOf() //Invalid key!
        )

        assertThrows<InvalidKeyException> { deviceInfoService.registerDevice(request) }
    }

    @Test
    fun `device block is saved to database`() {
        val deviceId = UUID.randomUUID()
        val targetDeviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        val deviceInfo = DeviceInfo(
            deviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Linux",
            null,
            false
        )

        val targetDeviceInfo = DeviceInfo(
            targetDeviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Linux",
            null,
            false
        )

        whenever { deviceInfoRepository.findById(deviceId) }
            .thenReturn(Optional.of(deviceInfo))

        whenever { deviceInfoRepository.findById(targetDeviceId) }
            .thenReturn(Optional.of(targetDeviceInfo))

        val captor = argumentCaptor<DeviceInfo>()

        deviceInfoService.blockDevice(deviceId, targetDeviceId)

        verify(deviceInfoRepository)
            .save(captor.capture())

        assert(captor.firstValue.id == targetDeviceId)
        assert(captor.firstValue.userId == targetDeviceInfo.userId)
        assert(captor.firstValue.publicIdentityKey == targetDeviceInfo.publicIdentityKey)
        assert(captor.firstValue.lastOs == targetDeviceInfo.lastOs)
        assert(captor.firstValue.lastSeen == targetDeviceInfo.lastSeen)

        assert(captor.firstValue.blocked)
    }

    @Test
    fun `device cannot be blocked more than once`() {
        val userId = UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b")

        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")
        val targetDeviceInfo = DeviceInfo(
            targetDeviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Windows",
            Instant.now(),
            true
        )

        val anotherDeviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")
        val anotherDeviceInfo = DeviceInfo(
            anotherDeviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Windows",
            Instant.now(),
            true
        )


        whenever(deviceInfoRepository.findById(targetDeviceId))
            .thenReturn(Optional.of(targetDeviceInfo))

        whenever(deviceInfoRepository.findById(anotherDeviceId))
            .thenReturn(Optional.of(anotherDeviceInfo))

        assertThrows<LockedException> {
            deviceInfoService.blockDevice(anotherDeviceId, targetDeviceId)
        }
    }

    @Test
    fun `device cannot be blocked by itself`() {
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        assertThrows<SelfLockNotAllowedException> {
            deviceInfoService.blockDevice(targetDeviceId, targetDeviceId)
        }
    }


    @Test
    fun `device cannot be blocked by other account`() {
        val deviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")
        val userId = UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b")

        val deviceInfo = DeviceInfo(
            deviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Windows",
            Instant.now(),
        )

        whenever { deviceInfoRepository.findById(deviceId) }
            .thenReturn(Optional.of(deviceInfo))

        val anotherDeviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")
        val anotherUserId = UUID.fromString("db6af75d-edba-40ed-b533-d025ef32e412")

        val anotherDeviceInfo = DeviceInfo(
            anotherDeviceId,
            anotherUserId,
            generateKeyPair().toPublicJWK(),
            "Windows",
            Instant.now(),
        )

        whenever { deviceInfoRepository.findById(anotherDeviceId) }
            .thenReturn(Optional.of(anotherDeviceInfo))

        assertThrows <AccessDeniedException> {
            deviceInfoService.blockDevice(deviceId, anotherDeviceId)
        }
    }

    @Test
    fun `get is blocked returns true for blocked device`() {
        val deviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")
        val deviceInfo = DeviceInfo(
            deviceId,
            UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b"),
            generateKeyPair().toPublicJWK(),
            "Windows",
            Instant.now(),
            true,
        )

        whenever(deviceInfoRepository.findById(deviceId))
            .thenReturn(Optional.of(deviceInfo))

        assert(deviceInfoService.getIsBlocked(deviceId))
    }

    @Test
    fun `get is blocked returns false for unblocked device`() {
        val deviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")
        val deviceInfo = DeviceInfo(
            deviceId,
            UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b"),
            generateKeyPair().toPublicJWK(),
            "Linux",
            Instant.now(),
            false,
        )

        whenever(deviceInfoRepository.findById(deviceId))
            .thenReturn(Optional.of(deviceInfo))

        assert(!deviceInfoService.getIsBlocked(deviceId))
    }

    @Test
    fun `get is blocked fails when device does not exist`() {
        val deviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")

        whenever(deviceInfoRepository.findById(deviceId))
            .thenReturn(Optional.empty())

        assertThrows<NoSuchElementException> {
            deviceInfoService.getIsBlocked(deviceId)
        }
    }

    @Test
    fun `get identity key returns correct identity key`() {
        val userId = UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b")
        val deviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")
        val deviceInfo = DeviceInfo(
            deviceId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Linux",
            Instant.now(),
            false,
        )

        whenever {
            deviceInfoRepository.findById(deviceId)
        }.thenReturn(
            Optional.of(deviceInfo)
        )

        val result = deviceInfoService.getIdentityKey(userId, deviceId)

        assert(result == deviceInfo.publicIdentityKey)
        assert(!result.isPrivate)
    }

    @Test
    fun `get identity key fails when device does not exist`() {
        whenever {
            deviceInfoRepository.findById(any())
        }.thenReturn(
            Optional.empty()
        )

        assertThrows <NoSuchElementException> {
            deviceInfoService.getIdentityKey(
                userId = UUID.randomUUID(),
                targetDeviceId = UUID.randomUUID()
            )
        }
    }

    @Test
    fun `get identity key fails when device does not belong to user`() {
        val userId = UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b")
        val otherUserId = UUID.fromString("2acc1ac6-a803-4c50-8645-39fa583aab88")

        val deviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")

        val deviceInfo = DeviceInfo(
            otherUserId,
            userId,
            generateKeyPair().toPublicJWK(),
            "Linux",
            Instant.now(),
            false,
        )

        whenever {
            deviceInfoRepository.findById(deviceId)
        }.thenReturn(
            Optional.of(deviceInfo)
        )

        assertThrows<AccessDeniedException> {
            deviceInfoService.getIdentityKey(otherUserId, deviceId)
        }
    }
}
