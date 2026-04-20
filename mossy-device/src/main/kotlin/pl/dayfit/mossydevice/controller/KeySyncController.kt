package pl.dayfit.mossydevice.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossydevice.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossydevice.dto.response.KeySyncInfoResponseDto
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
        @AuthenticationPrincipal userId: UUID,
        @RequestHeader("X-Device-ID") deviceId: UUID
    ): ResponseEntity<InitKeySyncResponseDto> {
        return ResponseEntity.ok(
            keySyncService.initKeySync(userId, deviceId)
        )
    }

    @GetMapping("/info/{code}")
    fun getKeySyncInfo(
        @PathVariable code: String,
        @AuthenticationPrincipal userId: UUID,
        @RequestHeader("X-Device-ID") deviceId: UUID
    ): ResponseEntity<KeySyncInfoResponseDto> {
        return ResponseEntity.ok(
            keySyncService.getKeySyncInfo(code, userId, deviceId)
        )
    }

    @GetMapping("/nonce")
    fun getNonce(
        @AuthenticationPrincipal userId: UUID,
        @RequestHeader("X-Device-ID") deviceId: UUID
    ): ResponseEntity<NonceResponseDto> {

        val nonce = nonceService.generateNonce(deviceId, userId)

        return ResponseEntity.ok(
            NonceResponseDto(nonce)
        )
    }
}