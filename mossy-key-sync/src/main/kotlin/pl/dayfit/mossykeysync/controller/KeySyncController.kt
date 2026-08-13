package pl.dayfit.mossykeysync.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossykeysync.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.service.KeySyncService
import java.util.UUID

@RestController
@RequestMapping("/key-sync")
class KeySyncController(
    private val keySyncService: KeySyncService
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
}
