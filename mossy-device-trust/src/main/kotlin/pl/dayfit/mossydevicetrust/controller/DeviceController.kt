package pl.dayfit.mossydevicetrust.controller

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.dto.request.BlockDeviceRequestDto
import pl.dayfit.mossydevicetrust.dto.request.ConfirmDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.request.CreateDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.response.CreateDeviceEnrollmentResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import pl.dayfit.mossydevicetrust.dto.response.GenericServerResponseDto
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrust.service.IdempotencyService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID

@RestController
class DeviceController(
    private val deviceInfoService: DeviceInfoService,
    private val idempotencyService: IdempotencyService
) {
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

    @PostMapping("/device/enrollment")
    fun createDeviceEnrollment(
        @RequestBody request: CreateDeviceEnrollmentRequestDto,
        @RequestHeader("Idempotency-Key") idempotencyKey: UUID,
        httpServletRequest: HttpServletRequest
    ): ResponseEntity<CreateDeviceEnrollmentResponseDto> {

        return idempotencyService.execute(
            idempotencyKey,
            request
        ) { deviceInfoService.createDeviceEnrollment(request, httpServletRequest.remoteAddr) }
    }

    @PostMapping("/device/enrollment/challenge")
    fun checkEnrollmentChallenge(
        @RequestBody request: ConfirmDeviceEnrollmentRequestDto,
        @AuthenticationPrincipal jwt: Jwt,
        @RequestHeader("Idempotency-Key") idempotencyKey: UUID
    ): ResponseEntity<RegisterDeviceResponseDto> {
        return idempotencyService.execute(
            idempotencyKey,
            request
        ) {
            val deviceId = deviceInfoService.confirmDeviceEnrollmentChallenge(
                request.enrollmentId,
                request.challengeId,
                request.signature,
                UUID.fromString(jwt.subject)
            )

            return@execute RegisterDeviceResponseDto(deviceId)
        }
    }

    @GetMapping("/device/enrollments")
    fun getEnrollments(@AuthenticationPrincipal jwt: Jwt): ResponseEntity<DeviceEnrollmentsResponseDto> {
        return ResponseEntity.ok(
            deviceInfoService.getDeviceEnrollments(
                UUID.fromString(jwt.subject)
            )
        )
    }

    @PostMapping("/device/enrollment/{enrollmentId}/approve")
    fun approveDeviceEnrollment(@AuthenticationPrincipal jwt: Jwt, @PathVariable enrollmentId: UUID): ResponseEntity<GenericServerResponseDto> {
        deviceInfoService.approveDeviceEnrollment(
            UUID.fromString(jwt.getClaimAsString("device_id")),
            UUID.fromString(jwt.subject),
            enrollmentId
        )

        return ResponseEntity.ok(GenericServerResponseDto("Approved device for enrollment $enrollmentId"))
    }

    @PostMapping("/internal/device")
    fun registerDevice(@Valid @RequestBody registerDeviceDto: RegisterDeviceRequestDto): ResponseEntity<RegisterDeviceResponseDto> {
        val id = deviceInfoService.registerDevice(
            registerDeviceDto.publicIdentityKey,
            registerDeviceDto.userId,
            registerDeviceDto.osName
        )

        return ResponseEntity.ok(
            RegisterDeviceResponseDto(id)
        )
    }

    @GetMapping("/internal/device/{deviceId}/block")
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
}
