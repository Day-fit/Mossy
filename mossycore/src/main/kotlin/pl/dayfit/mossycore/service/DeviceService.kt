package pl.dayfit.mossycore.service

import org.springframework.stereotype.Service
import pl.dayfit.mossycore.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossycore.model.UserDevice
import pl.dayfit.mossycore.repository.UserDeviceRepository
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class DeviceService(
    private val userDeviceRepository: UserDeviceRepository
) {
    fun registerDevice(userId: UUID, requestDto: RegisterDeviceRequestDto) {
        userDeviceRepository.save(
            UserDevice(
                null,
                userId,
                Base64.decode(requestDto.publicKey),
                null
            )
        )
    }
}