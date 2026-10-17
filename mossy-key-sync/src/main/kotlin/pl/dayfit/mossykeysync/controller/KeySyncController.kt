package pl.dayfit.mossykeysync.controller

import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossykeysync.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossykeysync.dto.request.UploadKeyDto
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.dto.response.PendingReceiverResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeysResponseDto
import pl.dayfit.mossykeysync.service.KeySyncEventService
import pl.dayfit.mossykeysync.service.KeySyncService
import java.util.UUID

@RestController
@RequestMapping("/key-sync")
class KeySyncController(
    private val keySyncService: KeySyncService,
    private val keySyncEventService: KeySyncEventService,
) {
    @PostMapping
    fun initKeySync(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody dto: InitKeySyncRequestDto
    ): ResponseEntity<InitKeySyncResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))
        return ResponseEntity.ok(
            keySyncService.initKeySync(userId, deviceId, dto)
        )
    }

    @PostMapping("/{code}")
    fun uploadKey(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable code: String,
        @RequestBody dto: UploadKeyDto
    ): ResponseEntity<Void> {
        val userId = UUID.fromString(jwt.subject)
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))

        keySyncService.processKeyUpload(userId, deviceId, code, dto)

        return ResponseEntity.ok()
            .build()
    }

    @GetMapping("/vault-keys")
    fun getVaultKeys(
        @AuthenticationPrincipal jwt: Jwt,
    ): ResponseEntity<VaultKeysResponseDto> {
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))

        return ResponseEntity.ok(keySyncService.getVaultKeys(
            deviceId,
        ))
    }

    @GetMapping("/receivers")
    fun getPendingReceivers(@AuthenticationPrincipal jwt: Jwt): ResponseEntity<List<PendingReceiverResponseDto>> {
        return ResponseEntity.ok(keySyncService.getPendingReceivers(UUID.fromString(jwt.subject)))
    }

    @GetMapping("/receiver-events", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun subscribeReceiverEvents(@AuthenticationPrincipal jwt: Jwt): SseEmitter {
        val deviceId = UUID.fromString(jwt.getClaimAsString("device_id"))

        return keySyncEventService.handleKeySyncEventSubscription(
            deviceId
        )
    }
}
