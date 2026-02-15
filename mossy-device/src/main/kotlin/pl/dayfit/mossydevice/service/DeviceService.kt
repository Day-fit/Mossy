package pl.dayfit.mossydevice.service

import com.nimbusds.jose.jwk.OctetKeyPair
import org.springframework.stereotype.Service
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.exception.InvalidKeyFormat
import pl.dayfit.mossydevice.model.UserDevice
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import java.security.SecureRandom
import java.text.ParseException
import java.util.UUID

@Service
class DeviceService(
    private val userDeviceRepository: UserDeviceRepository,
    private val secureRandom: SecureRandom
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeviceService::class.java)

    /**
     * Registers a new device for the specified user, saving its public keys and approval status.
     *
     * @param userId The unique identifier of the user registering the device.
     * @param requestDto The request data containing the public keys (Diffie-Hellman and identifier) for the device.
     * @return A response containing the device ID, a flag indicating if synchronization is required,
     *         and a synchronization code if applicable.
     * @throws InvalidKeyFormat If the provided key format in the request is invalid.
     */
    fun registerDevice(
        userId: UUID,
        requestDto: RegisterDeviceRequestDto
    ): RegisterDeviceResponseDto {
        val hasAnyDevicePaired: Boolean = userDeviceRepository.existsUserDevicesByUserIdAndApproved(
            userId,
            true
        )

        try {
            val publicKeyDH = OctetKeyPair.parse(requestDto.publicKeyDH).toPublicJWK()
            val publicKeyId = OctetKeyPair.parse(requestDto.publicKeyId).toPublicJWK()

            val result = userDeviceRepository.save(
                UserDevice(
                    null,
                    userId,
                    publicKeyDH,
                    publicKeyId,
                    hasAnyDevicePaired.not(),
                    null
                )
            )

            return RegisterDeviceResponseDto(
                result.deviceId!!,
                hasAnyDevicePaired,
                if (hasAnyDevicePaired) generateSyncCode() else null
            )
        } catch (e: ParseException) {
            logger.debug("Invalid key format provided", e)
            throw InvalidKeyFormat("Invalid key format")
        }
    }

    /**
     * Generates 6-digit sync code
     * @return generated sync code
     */
    private fun generateSyncCode(): String {
        val randomInt = secureRandom.nextInt(1, 999999)
        return String.format("%06d", randomInt)
    }
}