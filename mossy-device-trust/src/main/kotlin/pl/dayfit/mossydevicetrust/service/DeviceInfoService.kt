package pl.dayfit.mossydevicetrust.service

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.LockedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossydevicetrust.dto.request.CreateDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.response.CreateDeviceEnrollmentResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException
import pl.dayfit.mossydevicetrust.model.DeviceEnrollmentRequest
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.model.redis.DeviceEnrollment
import pl.dayfit.mossydevicetrust.repository.DeviceEnrollmentRequestRepository
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrust.repository.redis.DeviceEnrollmentRepository
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import java.security.InvalidKeyException
import java.time.Instant
import java.util.UUID

@Service
class DeviceInfoService(
    private val deviceInfoRepository: DeviceInfoRepository,
    private val deviceEnrollmentRepository: DeviceEnrollmentRepository,
    private val nonceChallengeService: NonceChallengeService,
    private val deviceEnrollmentRequestRepository: DeviceEnrollmentRequestRepository
) {
    fun registerDevice(rawPublicIdentityKey: Map<String, Any>, userId: UUID, osName: String): UUID {
        var publicIdentityKey: OctetKeyPair? = null

        runCatching {
            publicIdentityKey = OctetKeyPair.parse(
                rawPublicIdentityKey
            )
        }.onFailure {
            throw InvalidKeyException("Provided public key is invalid")
        }

        if (publicIdentityKey == null) {
            //Should never happen as variable is reassigned to non-null value
            //or exception is thrown
            throw IllegalStateException("Provided public key is null (bug?)")
        }

        if (publicIdentityKey.isPrivate) {
            throw InvalidKeyException("Provided key is not a public key")
        }

        val deviceInfo = DeviceInfo(
            userId = userId,
            publicIdentityKey = publicIdentityKey,
            lastOs = osName
        )

        val result = deviceInfoRepository.save(deviceInfo)
        return result.deviceId!!
    }

    fun createDeviceEnrollment(request: CreateDeviceEnrollmentRequestDto, remoteAddr: String): CreateDeviceEnrollmentResponseDto {
        val publicIdentityKey = OctetKeyPair.parse(request.publicIdentityKey)

        if (publicIdentityKey.isPrivate) {
            throw InvalidKeyException("Provided identity key is private")
        }

        val savedResult = deviceEnrollmentRepository.save(
            DeviceEnrollment(
                osName = request.osName,
                remoteAddr = remoteAddr,
                publicIdentityKey = publicIdentityKey,
            )
        )

        val enrollmentId = savedResult.enrollmentId!! //Should be not-null after saving to redis!
        val challengeDto = nonceChallengeService.generateNonce(
            enrollmentId,
            NonceChallengeTarget.DEVICE_ENROLLMENT
        )

        return CreateDeviceEnrollmentResponseDto(
            enrollmentId,
            challengeDto,
        )
    }

    fun confirmDeviceEnrollmentChallenge(
        enrollmentId: String,
        challengeId: UUID,
        signature: String,
        userId: UUID,
    ): UUID {
        val enrollment = deviceEnrollmentRepository.findById(enrollmentId)
            .orElseThrow { NoSuchElementException("No enrollment with id $enrollmentId") }

        val isChallengeValid = nonceChallengeService.isEnrollmentChallengeValid(
            challengeId,
            signature,
            enrollmentId,
            enrollment.publicIdentityKey,
        )

        if (!isChallengeValid) {
            throw BadCredentialsException("Challenge failed")
        }

        val savedEnrollmentRequest = deviceEnrollmentRequestRepository.save(
            DeviceEnrollmentRequest(
                userId = userId,
                publicIdentityKey = enrollment.publicIdentityKey,
                osName = enrollment.osName,
                remoteAddr = enrollment.remoteAddr,
                createdAt = Instant.now()
            )
        )

        deviceEnrollmentRepository.delete(
            enrollment
        )

        return savedEnrollmentRequest.id!!
    }

    fun getDeviceEnrollments(userId: UUID): DeviceEnrollmentsResponseDto {
        return DeviceEnrollmentsResponseDto(deviceEnrollmentRequestRepository.findByUserId(userId)
            .map {
                return@map DeviceEnrollmentsResponseDto.DeviceEnrollmentDto(
                    it.id!!,
                    it.osName,
                    it.remoteAddr,
                    it.createdAt
                )
            }
        )
    }

    @Transactional
    fun approveDeviceEnrollment(deviceId: UUID, userId: UUID, deviceEnrollmentId: UUID) {
        val enrollmentRequest = deviceEnrollmentRequestRepository.findById(deviceEnrollmentId)
            .orElseThrow { NoSuchElementException("No device enrollment with id $deviceId") }

        if (enrollmentRequest.userId != userId) throw AccessDeniedException("You are not allowed to approve this device")

        val device = deviceInfoRepository.findById(deviceId)
            .orElseThrow { IllegalStateException("Device with id $deviceId not found, but is provided in jwt claims") }

        if(device.blocked) throw AccessDeniedException("You are not allowed to approve this device")

        deviceEnrollmentRequestRepository.delete(
            enrollmentRequest
        )

        deviceInfoRepository.save(
            DeviceInfo(
                deviceId = enrollmentRequest.id,
                userId = userId,
                publicIdentityKey = enrollmentRequest.publicIdentityKey,
                lastOs = enrollmentRequest.osName,
            )
        )
    }

    fun blockDevice(deviceId: UUID, targetDeviceId: UUID) {
        if (deviceId == targetDeviceId) {
            throw SelfLockNotAllowedException("Device cannot be blocked by itself")
        }

        val deviceInfo = deviceInfoRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device found with id $deviceId") }

        val targetDeviceInfo = deviceInfoRepository.findById(targetDeviceId)
            .orElseThrow { NoSuchElementException("No device found with id $targetDeviceId") }

        if (deviceInfo.userId != targetDeviceInfo.userId) {
            throw AccessDeniedException("You are not owner of this device")
        }

        if (targetDeviceInfo.blocked) {
            throw LockedException("This device is already blocked")
        }

        targetDeviceInfo.blocked = true

        deviceInfoRepository.save(
            targetDeviceInfo
        )
    }

    fun getIsBlocked(deviceId: UUID): Boolean {
        val deviceInfo = deviceInfoRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device found with id $deviceId") }

        return deviceInfo.blocked
    }

    fun getIdentityKey(userId: UUID, targetDeviceId: UUID): OctetKeyPair {
        val deviceInfo = deviceInfoRepository.findById(targetDeviceId)
            .orElseThrow { NoSuchElementException("No device found with id $targetDeviceId") }

        if (deviceInfo.userId != userId) {
            throw AccessDeniedException("You are not owner of this device")
        }

        return deviceInfo.publicIdentityKey
            .toPublicJWK()
    }
}
