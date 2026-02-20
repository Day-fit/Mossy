package pl.dayfit.mossydevice.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.RegisterDeviceResponseDto
import pl.dayfit.mossydevice.service.DeviceService
import java.util.UUID

@RestController
@RequestMapping("/device")
class DeviceController(private val deviceService: DeviceService) {
    @PostMapping("/register")
    fun registerDevice(
        @AuthenticationPrincipal principal: UUID,
        @RequestBody requestDto: RegisterDeviceRequestDto
    ): ResponseEntity<RegisterDeviceResponseDto>
    {
        val response = deviceService.registerDevice(
            principal,
            requestDto
        )

        return ResponseEntity.ok(
            response
        )
    }
}