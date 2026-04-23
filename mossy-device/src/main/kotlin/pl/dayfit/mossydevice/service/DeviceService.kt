package pl.dayfit.mossydevice.service

import com.nimbusds.jose.jwk.OctetKeyPair
import com.nimbusds.jose.jwk.Curve
import org.springframework.stereotype.Service
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.exception.InvalidKeyFormat
import pl.dayfit.mossydevice.model.UserDevice
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import java.text.ParseException
import java.util.UUID

@Service
class DeviceService(
    private val userDeviceRepository: UserDeviceRepository,
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeviceService::class.java)


    /**
     * Registers a new device for a user. The method saves the device information along with its public keys
     * to the repository. If the user has no previously approved devices, the device is automatically approved.
     * Otherwise, a synchronization process is initiated and a sync code is generated for approval with an existing device.
     *
     * @param userId The unique identifier of the user for whom the device is being registered.
     * @param requestDto The details of the device being registered, including its public keys.
     * @return A response containing the device's unique identifier, whether synchronization is required,
     *         and the generated sync code if applicable.
     * @throws InvalidKeyFormat If the provided device public keys are invalid or cannot be parsed.
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
            val publicKeyId = OctetKeyPair.parse(requestDto.publicKeyId).toPublicJWK()

            if (publicKeyId.curve != Curve.Ed25519) {
                throw InvalidKeyFormat("Invalid key format")
            }

            val result = userDeviceRepository.save(
                UserDevice(
                    null,
                    userId,
                    publicKeyId,
                    hasAnyDevicePaired.not(),
                    null
                )
            )

            if (!hasAnyDevicePaired) {
                return RegisterDeviceResponseDto(
                    result.deviceId!!,
                    false,
                )
            }

            return RegisterDeviceResponseDto(
                result.deviceId!!,
                true,
            )
        } catch (e: ParseException) {
            logger.debug("Invalid key format provided", e)
            throw InvalidKeyFormat("Invalid key format")
        }
    }
}
