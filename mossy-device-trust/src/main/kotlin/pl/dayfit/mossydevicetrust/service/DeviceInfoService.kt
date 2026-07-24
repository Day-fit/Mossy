package pl.dayfit.mossydevicetrust.service

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.stereotype.Service
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import java.security.InvalidKeyException
import java.util.UUID

@Service
class DeviceInfoService(
    private val deviceInfoRepository: DeviceInfoRepository
) {
    fun registerDevice(request: RegisterDeviceRequestDto): UUID {
        var publicIdentityKey: OctetKeyPair? = null

        runCatching {
            publicIdentityKey = OctetKeyPair.parse(
                request.publicIdentityKey
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
            userId = request.userId,
            publicIdentityKey = publicIdentityKey,
            lastOs = request.osName
        )

        val result = deviceInfoRepository.save(deviceInfo)
        return result.id!!
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
}