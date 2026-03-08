package pl.dayfit.mossypassword.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.service.VaultRegistrationService

@RestController
@RequestMapping("/vault")
class VaultController(
    private val vaultRegistrationService: VaultRegistrationService
) {
    @PostMapping("/register")
    fun register(): ResponseEntity<VaultRegistrationResponseDto> {
        return ResponseEntity.ok(vaultRegistrationService.register())
    }
}
