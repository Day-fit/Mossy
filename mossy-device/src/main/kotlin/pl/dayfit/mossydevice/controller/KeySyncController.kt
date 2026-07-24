package pl.dayfit.mossydevice.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevice.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.dto.response.NonceResponseDto
import pl.dayfit.mossydevice.service.KeySyncService
import pl.dayfit.mossydevice.service.NonceService
import java.util.UUID

@RestController
@RequestMapping("/key-sync")
class KeySyncController(
    private val keySyncService: KeySyncService,
    private val nonceService: NonceService
) {
    @PostMapping("/init")
    fun initKeySync(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody dto: InitKeySyncRequestDto
    ): ResponseEntity<InitKeySyncResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))
        return ResponseEntity.ok(
            keySyncService.initKeySync(userId, deviceId, dto.vaultId)
        )
    }

    @GetMapping("/nonce")
    fun getNonce(
        @AuthenticationPrincipal jwt: Jwt
    ): ResponseEntity<NonceResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))

        val nonce = nonceService.generateNonce(deviceId, userId)

        return ResponseEntity.ok(
            NonceResponseDto(nonce)
        )
    }
}
