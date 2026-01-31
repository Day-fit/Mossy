package pl.dayfit.mossydevice.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevice.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevice.dto.response.ServerResponseDto
import pl.dayfit.mossydevice.service.DeviceService
import java.security.Principal
import java.util.UUID

@RestController("/device")
class DeviceController(private val deviceService: DeviceService) {
    @PostMapping("/register")
    fun registerDevice(
        @AuthenticationPrincipal principal: Principal,
        @RequestBody requestDto: RegisterDeviceRequestDto
    ): ResponseEntity<ServerResponseDto>
    {
        deviceService.registerDevice(
            UUID.fromString(principal.name),
            requestDto
        )

        return ResponseEntity.ok(
            ServerResponseDto("Device registered successfully")
        )
    }
}