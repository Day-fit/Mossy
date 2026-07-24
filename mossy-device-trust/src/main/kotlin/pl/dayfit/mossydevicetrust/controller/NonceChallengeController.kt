package pl.dayfit.mossydevicetrust.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
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
        @AuthenticationPrincipal jwt: Jwt
    ): ResponseEntity<GenerateNonceResponseDto> {
        return ResponseEntity.ok(nonceChallengeService.generateNonce(
            UUID.fromString(jwt.getClaimAsString("device_id"))
        ))
    }

    @PostMapping("/challenge")
    fun checkChallenge(
        @RequestBody requestDto: NonceChallengeRequestDto
    ): ResponseEntity<NonceChallengeResponseDto> {
        return ResponseEntity.ok(
            nonceChallengeService.isChallengeValid(
                requestDto,
            )
        )
    }
}
