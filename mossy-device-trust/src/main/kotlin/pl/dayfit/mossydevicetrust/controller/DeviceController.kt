package pl.dayfit.mossydevicetrust.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto

@RestController
class DeviceController(
    private val deviceInfoService: DeviceInfoService
) {
    @PostMapping("/device")
    fun registerDevice(@Valid @RequestBody registerDeviceDto: RegisterDeviceRequestDto): ResponseEntity<RegisterDeviceResponseDto> {
        val id = deviceInfoService.registerDevice(
            registerDeviceDto
        )

        return ResponseEntity.ok(
            RegisterDeviceResponseDto(id)
        )
    }
}