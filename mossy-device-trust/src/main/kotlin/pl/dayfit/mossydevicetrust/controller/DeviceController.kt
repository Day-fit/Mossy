package pl.dayfit.mossydevicetrust.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.dto.request.BlockDeviceRequestDto
import pl.dayfit.mossydevicetrust.dto.response.GenericServerResponseDto
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID

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

    @PostMapping("/device/block")
    fun blockDevice(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody blockDeviceRequestDto: BlockDeviceRequestDto
    ): ResponseEntity<GenericServerResponseDto> {
        deviceInfoService.blockDevice(
            UUID.fromString(jwt.getClaimAsString("device_id")),
            blockDeviceRequestDto.targetDeviceId!!
        )

        return ResponseEntity.ok(
            GenericServerResponseDto("Device blocked successfully")
        )
    }

    @GetMapping("/device/{deviceId}/block")
    fun getIsBlocked(
        @PathVariable deviceId: UUID,
    ): ResponseEntity<GetIsBlockedResponseDto> {
        val result = deviceInfoService.getIsBlocked(deviceId)

        return ResponseEntity.ok(
            GetIsBlockedResponseDto(
                isBlocked = result
            )
        )
    }

    @GetMapping("/device/{deviceId}/identity-key")
    fun getIdentityKey(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable deviceId: UUID
    ): ResponseEntity<Map<String, Any>> {
        val key = deviceInfoService.getIdentityKey(
            UUID.fromString(jwt.subject),
            deviceId
        )

        return ResponseEntity.ok(
            key.toJSONObject()
        )
    }
}
