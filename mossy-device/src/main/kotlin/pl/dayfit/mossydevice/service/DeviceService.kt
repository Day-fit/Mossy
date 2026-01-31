package pl.dayfit.mossydevice.service

import org.springframework.stereotype.Service
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.model.UserDevice
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class DeviceService(
    private val userDeviceRepository: UserDeviceRepository
) {
    fun registerDevice(
        userId: UUID,
        requestDto: RegisterDeviceRequestDto
    ): RegisterDeviceResponseDto {
        val hasAnyDevicePaired: Boolean = userDeviceRepository.existsUserDevicesByUserIdAndApproved(
            userId,
            true
        )

        val result = userDeviceRepository.save(
            UserDevice(
                null,
                userId,
                Base64.decode(requestDto.publicKey),
                hasAnyDevicePaired.not(),
                null
            )
        )

        return RegisterDeviceResponseDto(
            result.deviceId!!,
            hasAnyDevicePaired
        )
    }
}