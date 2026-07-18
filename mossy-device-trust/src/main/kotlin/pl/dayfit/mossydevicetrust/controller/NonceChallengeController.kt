package pl.dayfit.mossydevicetrust.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrustshared.dto.request.NonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateNonceResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import java.util.UUID

@RestController
@RequestMapping("/nonce")
class NonceChallengeController(
    private val nonceChallengeService: NonceChallengeService
) {
    /**
     * This endpoint provides challenge that user must provide during logging in
     */
    @GetMapping
    fun generateChallenge(
        @RequestHeader("X-Device-Id") deviceId: UUID
    ): ResponseEntity<GenerateNonceResponseDto> {
        return ResponseEntity.ok(nonceChallengeService.generateNonce(
            deviceId
        ))
    }

    @PostMapping("/challenge")
    fun checkChallenge(
        @RequestHeader("X-Device-Id") deviceId: UUID,
        @RequestBody requestDto: NonceChallengeRequestDto
    ): ResponseEntity<NonceChallengeResponseDto> {
        return ResponseEntity.ok(
            nonceChallengeService.isChallengeValid(
                requestDto,
                deviceId
            )
        )
    }
}