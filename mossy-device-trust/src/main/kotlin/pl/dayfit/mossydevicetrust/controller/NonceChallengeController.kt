package pl.dayfit.mossydevicetrust.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import java.util.UUID

@RestController
@RequestMapping("/nonce")
class NonceChallengeController(
    private val nonceChallengeService: NonceChallengeService
) {
    /**
     * This endpoint provides challenge that user must provide during logging in
     */
    @GetMapping("/{claimedDeviceId}")
    fun generateChallenge(
        @PathVariable claimedDeviceId: UUID,
    ): ResponseEntity<GenerateChallengeResponseDto> {
        return ResponseEntity.ok(nonceChallengeService.generateNonce(
            claimedDeviceId.toString(),
            NonceChallengeTarget.EXISTING_DEVICE
        ))
    }
}
