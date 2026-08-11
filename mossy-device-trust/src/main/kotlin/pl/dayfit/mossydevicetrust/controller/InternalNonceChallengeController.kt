package pl.dayfit.mossydevicetrust.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrustshared.dto.request.VerifyNonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.InternalResponseDto

@RestController
@RequestMapping("/internal/nonce")
class InternalNonceChallengeController(
    private val nonceChallengeService: NonceChallengeService,
) {
    @PostMapping("/challenge")
    fun checkChallenge(
        @RequestBody request: VerifyNonceChallengeRequestDto,
    ): ResponseEntity<InternalResponseDto<NonceChallengeResponseDto>> = ResponseEntity.ok(
        InternalResponseDto(
            result = nonceChallengeService.isLoginChallengeValid(
                request.challengeId,
                request.signature,
                request.deviceId,
                request.userId,
            )
        )
    )
}
