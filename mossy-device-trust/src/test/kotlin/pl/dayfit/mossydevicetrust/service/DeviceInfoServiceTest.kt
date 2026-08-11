package pl.dayfit.mossydevicetrust.service

import com.nimbusds.jose.jwk.Curve
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.security.authentication.BadCredentialsException
import pl.dayfit.mossydevicetrust.dto.request.CreateDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException
import pl.dayfit.mossydevicetrust.model.DeviceEnrollmentRequest
import pl.dayfit.mossydevicetrust.helper.KeygenHelper.generateKeyPair
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.model.redis.DeviceEnrollment
import pl.dayfit.mossydevicetrust.repository.DeviceEnrollmentRequestRepository
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrust.repository.redis.DeviceEnrollmentRepository
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import java.security.InvalidKeyException
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class DeviceInfoServiceTest {
    @Mock
    lateinit var deviceEnrollmentRequestRepository: DeviceEnrollmentRequestRepository

    @Mock
    lateinit var nonceChallengeService: NonceChallengeService

    @Mock
    lateinit var deviceEnrollmentRepository: DeviceEnrollmentRepository

    @Mock
    lateinit var deviceInfoRepository: DeviceInfoRepository

    @InjectMocks
    lateinit var deviceInfoService: DeviceInfoService

    @Test
    fun `saves device info with same key as provided`() {
        val publicJwk = generateKeyPair()
            .toPublicJWK()

        assert(!publicJwk.isPrivate)

        val userId = UUID.randomUUID()

        whenever(deviceInfoRepository.save(any<DeviceInfo>()))
            .thenReturn(
                DeviceInfo(
                    deviceId = UUID.randomUUID(),
                    userId = userId,
                    publicJwk.decodedX,
                    "Android"
                )
            )

        deviceInfoService.registerDevice(
            publicJwk.toJSONObject(),
            userId,
            "Windows",
        )

        verify(deviceInfoRepository).save(
            argThat { deviceInfo ->
                deviceInfo.publicIdentityKey.contentEquals(publicJwk.decodedX)
            }
        )
    }

    @Test
    fun `fails if provided key is not public key`() {
        val jwk = generateKeyPair()
        assert(jwk.isPrivate)

        assertThrows<InvalidKeyException> { deviceInfoService.registerDevice(
            jwk.toJSONObject(),
            UUID.randomUUID(),
            "Windows",
        ) }
    }

    @Test
    fun `fails if key is invalid`() {
        assertThrows<InvalidKeyException> { deviceInfoService.registerDevice(
            mapOf(), //Invalid key!
            UUID.randomUUID(),
            "Windows",
        ) }
    }

    @Test
    fun `device block is saved to database`() {
        val deviceId = UUID.randomUUID()
        val targetDeviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        val deviceInfo = DeviceInfo(
            deviceId,
            userId,
            generateKeyPair().toPublicJWK().decodedX,
            "Linux",
            null,
            false
        )

        val targetDeviceInfo = DeviceInfo(
            targetDeviceId,
            userId,
            generateKeyPair().toPublicJWK().decodedX,
            "Linux",
            null,
            false
        )

        whenever { deviceInfoRepository.findById(deviceId) }
            .thenReturn(Optional.of(deviceInfo))

        whenever { deviceInfoRepository.findById(targetDeviceId) }
            .thenReturn(Optional.of(targetDeviceInfo))

        val captor = argumentCaptor<DeviceInfo>()

        deviceInfoService.setDeviceBlocked(deviceId, targetDeviceId, true)

        verify(deviceInfoRepository)
            .save(captor.capture())

        assert(captor.firstValue.deviceId == targetDeviceId)
        assert(captor.firstValue.userId == targetDeviceInfo.userId)
        assert(captor.firstValue.publicIdentityKey.contentEquals(targetDeviceInfo.publicIdentityKey))
        assert(captor.firstValue.lastUserAgent == targetDeviceInfo.lastUserAgent)
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
            generateKeyPair().toPublicJWK().decodedX,
            "Windows",
            Instant.now(),
            true
        )

        val anotherDeviceId = UUID.fromString("9756dc28-c399-40f5-9145-ee40833404aa")
        val anotherDeviceInfo = DeviceInfo(
            anotherDeviceId,
            userId,
            generateKeyPair().toPublicJWK().decodedX,
            "Windows",
            Instant.now(),
            false
        )


        whenever(deviceInfoRepository.findById(targetDeviceId))
            .thenReturn(Optional.of(targetDeviceInfo))

        whenever(deviceInfoRepository.findById(anotherDeviceId))
            .thenReturn(Optional.of(anotherDeviceInfo))

        assertThrows<LockedException> {
            deviceInfoService.setDeviceBlocked(anotherDeviceId, targetDeviceId, true)
        }
    }

    @Test
    fun `blocked device cannot block another device`() {
        val userId = UUID.randomUUID()
        val blockedDevice = deviceInfo(UUID.randomUUID(), userId, blocked = true)
        val target = deviceInfo(UUID.randomUUID(), userId)
        whenever(deviceInfoRepository.findById(blockedDevice.deviceId))
            .thenReturn(Optional.of(blockedDevice))
        whenever(deviceInfoRepository.findById(target.deviceId))
            .thenReturn(Optional.of(target))

        assertThrows<AccessDeniedException> {
            deviceInfoService.setDeviceBlocked(blockedDevice.deviceId, target.deviceId, true)
        }

        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
    }

    @Test
    fun `device cannot be blocked by itself`() {
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        assertThrows<SelfLockNotAllowedException> {
            deviceInfoService.setDeviceBlocked(targetDeviceId, targetDeviceId, true)
        }
    }


    @Test
    fun `device cannot be blocked by other account`() {
        val deviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")
        val userId = UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b")

        val deviceInfo = DeviceInfo(
            deviceId,
            userId,
            generateKeyPair().toPublicJWK().decodedX,
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
            generateKeyPair().toPublicJWK().decodedX,
            "Windows",
            Instant.now(),
        )

        whenever { deviceInfoRepository.findById(anotherDeviceId) }
            .thenReturn(Optional.of(anotherDeviceInfo))

        assertThrows <AccessDeniedException> {
            deviceInfoService.setDeviceBlocked(deviceId, anotherDeviceId, true)
        }
    }

    @Test
    fun `get is blocked returns true for blocked device`() {
        val deviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")
        val deviceInfo = DeviceInfo(
            deviceId,
            UUID.fromString("155eacf5-ca0b-4d27-b2c2-ad14ab81c20b"),
            generateKeyPair().toPublicJWK().decodedX,
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
            generateKeyPair().toPublicJWK().decodedX,
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
            generateKeyPair().toPublicJWK().decodedX,
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

        assert(result.decodedX.contentEquals(deviceInfo.publicIdentityKey))
        assertEquals(Curve.Ed25519, result.curve)
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
            generateKeyPair().toPublicJWK().decodedX,
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

    @Test
    fun `creating enrollment persists request and creates challenge for stored id`() {
        val publicIdentityKey = generateKeyPair().toPublicJWK()
        val request = CreateDeviceEnrollmentRequestDto(
            userAgent = "Windows",
            publicIdentityKey = publicIdentityKey.toJSONObject(),
        )
        val enrollmentId = "enrollment-id"
        val remoteAddr = "192.0.2.1"
        val challenge = GenerateChallengeResponseDto(
            "random-nonce",
            Instant.now().plusSeconds(30),
            UUID.randomUUID(),
        )

        whenever {
            deviceEnrollmentRepository.save(any<DeviceEnrollment>())
        }.thenReturn(
            DeviceEnrollment(
                enrollmentId = enrollmentId,
                userAgent = request.userAgent,
                remoteAddr = remoteAddr,
                publicIdentityKey = publicIdentityKey.decodedX,
            )
        )

        whenever {
            nonceChallengeService.generateNonce(
                enrollmentId,
                NonceChallengeTarget.DEVICE_ENROLLMENT
            )
        }.thenReturn(challenge)

        deviceInfoService.createDeviceEnrollment(request, remoteAddr)

        verify(deviceEnrollmentRepository).save(
            argThat { enrollment ->
                enrollment.enrollmentId == null &&
                    enrollment.userAgent == request.userAgent &&
                    enrollment.remoteAddr == remoteAddr &&
                    enrollment.publicIdentityKey.contentEquals(publicIdentityKey.decodedX)
            }
        )
        verify(nonceChallengeService).generateNonce(
            enrollmentId,
            NonceChallengeTarget.DEVICE_ENROLLMENT,
        )
    }

    @Test
    fun `creating enrollment rejects a private identity key`() {
        val request = CreateDeviceEnrollmentRequestDto(
            userAgent = "Linux",
            publicIdentityKey = generateKeyPair().toJSONObject(),
        )

        assertThrows<InvalidKeyException> {
            deviceInfoService.createDeviceEnrollment(request, "192.0.2.1")
        }

        verify(deviceEnrollmentRepository, never()).save(any<DeviceEnrollment>())
        verify(nonceChallengeService, never()).generateNonce(any(), any())
    }

    @Test
    fun `creating enrollment rejects a valid non Ed25519 identity key`() {
        val request = CreateDeviceEnrollmentRequestDto(
            userAgent = "Linux",
            publicIdentityKey = generateKeyPair(Curve.X25519).toPublicJWK().toJSONObject(),
        )

        assertThrows<InvalidKeyException> {
            deviceInfoService.createDeviceEnrollment(request, "192.0.2.1")
        }

        verify(deviceEnrollmentRepository, never()).save(any<DeviceEnrollment>())
        verify(nonceChallengeService, never()).generateNonce(any(), any())
    }

    @Test
    fun `confirming enrollment creates pending request for authenticated user and consumes temporary enrollment`() {
        val enrollmentId = "enrollment-id"
        val challengeId = UUID.randomUUID()
        val signature = "signed-nonce"
        val userId = UUID.randomUUID()
        val publicIdentityKey = generateKeyPair().toPublicJWK()
        val enrollment = DeviceEnrollment(
            enrollmentId = enrollmentId,
            userAgent = "Android",
            remoteAddr = "192.0.2.1",
            publicIdentityKey = publicIdentityKey.decodedX,
        )

        whenever(deviceEnrollmentRepository.findById(enrollmentId))
            .thenReturn(Optional.of(enrollment))
        whenever(
            nonceChallengeService.isEnrollmentChallengeValid(
                challengeId,
                signature,
                enrollmentId,
                publicIdentityKey.decodedX,
            )
        ).thenReturn(true)

        whenever(deviceEnrollmentRequestRepository.save(any<DeviceEnrollmentRequest>()))
            .thenAnswer { invocation ->
                invocation.getArgument<DeviceEnrollmentRequest>(0).apply {
                    id = UUID.randomUUID()
                }
            }

        val confirmationStartedAt = Instant.now()
        deviceInfoService.confirmDeviceEnrollmentChallenge(
            enrollmentId,
            challengeId,
            signature,
            userId,
        )
        val confirmationCompletedAt = Instant.now()

        val requestCaptor = argumentCaptor<DeviceEnrollmentRequest>()
        verify(deviceEnrollmentRequestRepository).save(requestCaptor.capture())
        with(requestCaptor.firstValue) {
            assertEquals(userId, this.userId)
            assertEquals(enrollment.remoteAddr, remoteAddr)
            assertEquals(enrollment.userAgent, userAgent)
            assertTrue(publicIdentityKey.decodedX.contentEquals(this.publicIdentityKey))
            assertTrue(!createdAt.isBefore(confirmationStartedAt))
            assertTrue(!createdAt.isAfter(confirmationCompletedAt))
        }
        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRepository).delete(enrollment)
    }

    @Test
    fun `getting enrollments queries by user and maps request metadata`() {
        val userId = UUID.randomUUID()
        val ownRequest = DeviceEnrollmentRequest(
            id = UUID.randomUUID(),
            userId = userId,
            remoteAddr = "192.0.2.10",
            userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
            publicIdentityKey = generateKeyPair().toPublicJWK().decodedX,
            createdAt = Instant.parse("2026-08-10T12:00:00Z"),
        )

        whenever(deviceEnrollmentRequestRepository.findByUserId(userId))
            .thenReturn(mutableListOf(ownRequest))

        val result = deviceInfoService.getDeviceEnrollments(userId)

        verify(deviceEnrollmentRequestRepository).findByUserId(userId)
        assertEquals(1, result.enrollments.size)
        with(result.enrollments.single()) {
            assertEquals(ownRequest.id, id)
            assertEquals("Linux", lastOsName)
            assertEquals("Desktop", deviceType)
            assertEquals(ownRequest.remoteAddr, remoteAddr)
            assertEquals(ownRequest.createdAt, createdAt)
        }
    }

    @Test
    fun `approving enrollment registers requested device and removes pending request`() {
        val userId = UUID.randomUUID()
        val approvingDeviceId = UUID.randomUUID()
        val enrollmentRequestId = UUID.randomUUID()
        val publicIdentityKey = generateKeyPair().toPublicJWK()
        val enrollmentRequest = DeviceEnrollmentRequest(
            id = enrollmentRequestId,
            userId = userId,
            remoteAddr = "192.0.2.30",
            userAgent = "Windows",
            publicIdentityKey = publicIdentityKey.decodedX,
            createdAt = Instant.parse("2026-08-10T12:00:00Z"),
        )

        whenever(deviceInfoRepository.findById(approvingDeviceId))
            .thenReturn(
                Optional.of(
                    DeviceInfo(
                        deviceId = approvingDeviceId,
                        userId = userId,
                        publicIdentityKey = generateKeyPair().toPublicJWK().decodedX,
                        lastUserAgent = "Linux",
                    )
                )
            )
        whenever(deviceEnrollmentRequestRepository.findById(enrollmentRequestId))
            .thenReturn(Optional.of(enrollmentRequest))
        deviceInfoService.approveDeviceEnrollment(
            approvingDeviceId,
            userId,
            enrollmentRequestId,
        )

        val deviceCaptor = argumentCaptor<DeviceInfo>()
        verify(deviceInfoRepository).save(deviceCaptor.capture())
        with(deviceCaptor.firstValue) {
            assertEquals(enrollmentRequest.id, deviceId)
            assertEquals(userId, this.userId)
            assertTrue(publicIdentityKey.decodedX.contentEquals(this.publicIdentityKey))
            assertEquals(enrollmentRequest.userAgent, lastUserAgent)
            assertTrue(isNew, "approved device must be persisted instead of merged")
        }
        verify(deviceEnrollmentRequestRepository).delete(enrollmentRequest)
    }

    @Test
    fun `lists only user devices and marks the current device`() {
        val userId = UUID.randomUUID()
        val currentDevice = deviceInfo(UUID.randomUUID(), userId)
        val blockedDevice = deviceInfo(UUID.randomUUID(), userId, blocked = true)
        whenever(deviceInfoRepository.findAllByUserId(userId))
            .thenReturn(listOf(currentDevice, blockedDevice))

        val result = deviceInfoService.getDevices(userId, currentDevice.deviceId)

        assertEquals(2, result.devices.size)
        with(result.devices.first()) {
            assertEquals(currentDevice.deviceId, id)
            assertTrue(current)
            assertFalse(blocked)
        }
        with(result.devices.last()) {
            assertEquals(blockedDevice.deviceId, id)
            assertFalse(current)
            assertTrue(blocked)
        }
        verify(deviceInfoRepository).findAllByUserId(userId)
    }

    @Test
    fun `unblocking owned device saves its active state`() {
        val userId = UUID.randomUUID()
        val approvingDevice = deviceInfo(UUID.randomUUID(), userId)
        val blockedDevice = deviceInfo(UUID.randomUUID(), userId, blocked = true)
        whenever(deviceInfoRepository.findById(approvingDevice.deviceId))
            .thenReturn(Optional.of(approvingDevice))
        whenever(deviceInfoRepository.findById(blockedDevice.deviceId))
            .thenReturn(Optional.of(blockedDevice))

        deviceInfoService.setDeviceBlocked(approvingDevice.deviceId, blockedDevice.deviceId, false)

        val captor = argumentCaptor<DeviceInfo>()
        verify(deviceInfoRepository).save(captor.capture())
        assertEquals(blockedDevice.deviceId, captor.firstValue.deviceId)
        assertFalse(captor.firstValue.blocked)
    }

    @Test
    fun `blocked device cannot unblock another device`() {
        val userId = UUID.randomUUID()
        val blockedApprover = deviceInfo(UUID.randomUUID(), userId, blocked = true)
        val target = deviceInfo(UUID.randomUUID(), userId, blocked = true)
        whenever(deviceInfoRepository.findById(blockedApprover.deviceId))
            .thenReturn(Optional.of(blockedApprover))
        whenever(deviceInfoRepository.findById(target.deviceId))
            .thenReturn(Optional.of(target))

        assertThrows<AccessDeniedException> {
            deviceInfoService.setDeviceBlocked(blockedApprover.deviceId, target.deviceId, false)
        }

        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
    }

    @Test
    fun `approving enrollment fails when enrollment request does not exist`() {
        val enrollmentRequestId = UUID.randomUUID()

        whenever(deviceEnrollmentRequestRepository.findById(enrollmentRequestId))
            .thenReturn(Optional.empty())

        assertThrows<NoSuchElementException> {
            deviceInfoService.approveDeviceEnrollment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                enrollmentRequestId,
            )
        }

        verify(deviceInfoRepository, never()).findById(any())
        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRequestRepository, never()).delete(any<DeviceEnrollmentRequest>())
    }

    @Test
    fun `approving enrollment fails when enrollment belongs to another user`() {
        val userId = UUID.randomUUID()
        val enrollmentRequest = pendingEnrollmentRequest(UUID.randomUUID())

        whenever(deviceEnrollmentRequestRepository.findById(enrollmentRequest.id!!))
            .thenReturn(Optional.of(enrollmentRequest))

        assertThrows<AccessDeniedException> {
            deviceInfoService.approveDeviceEnrollment(
                UUID.randomUUID(),
                userId,
                enrollmentRequest.id!!,
            )
        }

        verify(deviceInfoRepository, never()).findById(any())
        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRequestRepository, never()).delete(any<DeviceEnrollmentRequest>())
    }

    @Test
    fun `approving enrollment fails when approving device does not exist`() {
        val userId = UUID.randomUUID()
        val approvingDeviceId = UUID.randomUUID()
        val enrollmentRequest = pendingEnrollmentRequest(userId)

        whenever(deviceEnrollmentRequestRepository.findById(enrollmentRequest.id!!))
            .thenReturn(Optional.of(enrollmentRequest))
        whenever(deviceInfoRepository.findById(approvingDeviceId))
            .thenReturn(Optional.empty())

        assertThrows<IllegalStateException> {
            deviceInfoService.approveDeviceEnrollment(
                approvingDeviceId,
                userId,
                enrollmentRequest.id!!,
            )
        }

        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRequestRepository, never()).delete(any<DeviceEnrollmentRequest>())
    }

    @Test
    fun `approving enrollment fails when approving device is blocked`() {
        val userId = UUID.randomUUID()
        val approvingDeviceId = UUID.randomUUID()
        val enrollmentRequest = pendingEnrollmentRequest(userId)

        whenever(deviceEnrollmentRequestRepository.findById(enrollmentRequest.id!!))
            .thenReturn(Optional.of(enrollmentRequest))
        whenever(deviceInfoRepository.findById(approvingDeviceId))
            .thenReturn(Optional.of(deviceInfo(approvingDeviceId, userId, blocked = true)))

        assertThrows<AccessDeniedException> {
            deviceInfoService.approveDeviceEnrollment(
                approvingDeviceId,
                userId,
                enrollmentRequest.id!!,
            )
        }

        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRequestRepository, never()).delete(any<DeviceEnrollmentRequest>())
    }

    @Test
    fun `confirming enrollment rejects invalid challenge without registering device`() {
        val enrollmentId = "enrollment-id"
        val challengeId = UUID.randomUUID()
        val signature = "invalid-signature"
        val publicIdentityKey = generateKeyPair().toPublicJWK()
        val enrollment = DeviceEnrollment(
            enrollmentId = enrollmentId,
            userAgent = "Linux",
            remoteAddr = "192.0.2.1",
            publicIdentityKey = publicIdentityKey.decodedX,
        )

        whenever(deviceEnrollmentRepository.findById(enrollmentId))
            .thenReturn(Optional.of(enrollment))
        whenever(
            nonceChallengeService.isEnrollmentChallengeValid(
                challengeId,
                signature,
                enrollmentId,
                publicIdentityKey.decodedX,
            )
        ).thenReturn(false)

        assertThrows<BadCredentialsException> {
            deviceInfoService.confirmDeviceEnrollmentChallenge(
                enrollmentId,
                challengeId,
                signature,
                UUID.randomUUID(),
            )
        }

        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
        verify(deviceEnrollmentRepository, never()).delete(any<DeviceEnrollment>())
    }

    @Test
    fun `confirming enrollment fails when enrollment does not exist`() {
        val enrollmentId = "missing-enrollment"

        whenever(deviceEnrollmentRepository.findById(enrollmentId))
            .thenReturn(Optional.empty())

        assertThrows<NoSuchElementException> {
            deviceInfoService.confirmDeviceEnrollmentChallenge(
                enrollmentId,
                UUID.randomUUID(),
                "signed-nonce",
                UUID.randomUUID(),
            )
        }

        verify(nonceChallengeService, never())
            .isEnrollmentChallengeValid(any(), any(), any(), any())
        verify(deviceInfoRepository, never()).save(any<DeviceInfo>())
    }

    private fun pendingEnrollmentRequest(userId: UUID): DeviceEnrollmentRequest = DeviceEnrollmentRequest(
        id = UUID.randomUUID(),
        userId = userId,
        remoteAddr = "192.0.2.30",
        userAgent = "Windows",
        publicIdentityKey = generateKeyPair().toPublicJWK().decodedX,
        createdAt = Instant.parse("2026-08-10T12:00:00Z"),
    )

    private fun deviceInfo(deviceId: UUID, userId: UUID, blocked: Boolean = false) = DeviceInfo(
        deviceId = deviceId,
        userId = userId,
        publicIdentityKey = generateKeyPair().toPublicJWK().decodedX,
        lastUserAgent = "Linux",
        blocked = blocked,
    )
}
