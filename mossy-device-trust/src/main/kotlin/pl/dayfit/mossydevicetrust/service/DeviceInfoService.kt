package pl.dayfit.mossydevicetrust.service

import com.nimbusds.jose.jwk.OctetKeyPair
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.util.Base64URL
import nl.basjes.parse.useragent.UserAgent
import nl.basjes.parse.useragent.UserAgentAnalyzer
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.LockedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossydevicetrust.dto.request.CreateDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.response.CreateDeviceEnrollmentResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DevicesResponseDto
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
    companion object {
        val userAgentAnalyzer: UserAgentAnalyzer = UserAgentAnalyzer.newBuilder()
            .build()
    }

    fun registerDevice(rawPublicIdentityKey: Map<String, Any>, userId: UUID, userAgent: String): UUID {
        val publicIdentityKey = parsePublicEd25519Key(rawPublicIdentityKey)

        val deviceInfo = DeviceInfo(
            userId = userId,
            publicIdentityKey = publicIdentityKey.decodedX,
            lastUserAgent = userAgent
        )

        val result = deviceInfoRepository.save(deviceInfo)
        return result.deviceId
    }

    fun createDeviceEnrollment(request: CreateDeviceEnrollmentRequestDto, remoteAddr: String): CreateDeviceEnrollmentResponseDto {
        val publicIdentityKey = parsePublicEd25519Key(request.publicIdentityKey)

        val savedResult = deviceEnrollmentRepository.save(
            DeviceEnrollment(
                userAgent = request.userAgent,
                remoteAddr = remoteAddr,
                publicIdentityKey = publicIdentityKey.decodedX,
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
                userAgent = enrollment.userAgent,
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
                val userAgent = userAgentAnalyzer.parse(it.userAgent)

                val osName = userAgent.getValue(UserAgent.OPERATING_SYSTEM_NAME)
                val deviceType = userAgent.getValue(UserAgent.DEVICE_CLASS)

                return@map DeviceEnrollmentsResponseDto.DeviceEnrollmentDto(
                    it.id!!,
                    osName,
                    deviceType,
                    it.remoteAddr,
                    it.createdAt
                )
            }
        )
    }

    fun getDevices(userId: UUID, currentDeviceId: UUID): DevicesResponseDto {
        return DevicesResponseDto(
            deviceInfoRepository.findAllByUserId(userId).map { device ->
                val userAgent = userAgentAnalyzer.parse(device.lastUserAgent)

                val osName = userAgent.getValue(UserAgent.OPERATING_SYSTEM_NAME)
                val deviceType = userAgent.getValue(UserAgent.DEVICE_CLASS)

                DevicesResponseDto.DeviceDto(
                    id = device.deviceId,
                    lastOsName = osName,
                    deviceType = deviceType,
                    lastSeen = device.lastSeen,
                    blocked = device.blocked,
                    current = device.deviceId == currentDeviceId,
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
                deviceId = checkNotNull(enrollmentRequest.id),
                userId = userId,
                publicIdentityKey = enrollmentRequest.publicIdentityKey,
                lastUserAgent = enrollmentRequest.userAgent,
            )
        )
    }

    @Transactional
    fun setDeviceBlocked(deviceId: UUID, targetDeviceId: UUID, blocked: Boolean) {
        if (deviceId == targetDeviceId) {
            throw SelfLockNotAllowedException("Device cannot change its own block state")
        }

        val deviceInfo = deviceInfoRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("No device found with id $deviceId") }

        val targetDeviceInfo = deviceInfoRepository.findById(targetDeviceId)
            .orElseThrow { NoSuchElementException("No device found with id $targetDeviceId") }

        if (deviceInfo.blocked) {
            throw AccessDeniedException("Blocked device cannot manage other devices")
        }

        if (deviceInfo.userId != targetDeviceInfo.userId) {
            throw AccessDeniedException("You are not owner of this device")
        }

        if (targetDeviceInfo.blocked == blocked) {
            if (!blocked) return
            throw LockedException("This device is already blocked")
        }

        targetDeviceInfo.blocked = blocked

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

        return OctetKeyPair.Builder(
            Curve.Ed25519,
            Base64URL.encode(deviceInfo.publicIdentityKey),
        ).build()
    }

    private fun parsePublicEd25519Key(rawPublicIdentityKey: Map<String, Any>): OctetKeyPair {
        val publicIdentityKey = try {
            OctetKeyPair.parse(rawPublicIdentityKey)
        } catch (_: Exception) {
            throw InvalidKeyException("Provided public key is invalid")
        }

        if (publicIdentityKey.isPrivate) {
            throw InvalidKeyException("Provided key is not a public key")
        }

        if (publicIdentityKey.curve != Curve.Ed25519) {
            throw InvalidKeyException("Provided key is not an Ed25519 key")
        }

        return publicIdentityKey
    }
}
