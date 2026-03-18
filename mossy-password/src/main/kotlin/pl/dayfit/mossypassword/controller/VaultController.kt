package pl.dayfit.mossypassword.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.request.VaultRegistrationRequestDto
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.service.VaultAuthService
import pl.dayfit.mossypassword.service.VaultStatusService
import java.util.UUID

@RestController
@RequestMapping("/vault")
class VaultController(
    private val vaultAuthService: VaultAuthService,
    private val vaultStatusService: VaultStatusService
) {

    /**
     * Handles the registration of a new vault by generating an API key and storing it in the database.
     * Requires a user to be authenticated.
     *
     * @return a ResponseEntity containing a VaultRegistrationResponseDto, which includes the unique
     * vault identifier and the generated API key.
     */
    @PostMapping("/register")
    fun register(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody vaultRegistrationRequestDto: VaultRegistrationRequestDto
    ): ResponseEntity<VaultRegistrationResponseDto> {
        return ResponseEntity.ok(
            vaultAuthService.register(userId, vaultRegistrationRequestDto)
        )
    }

    /**
     *
     */
    @GetMapping("/vaults")
    fun getVaults(
        @AuthenticationPrincipal userId: UUID
    ): ResponseEntity<List<VaultStatusResponseDto>>
    {
        return ResponseEntity.ok(
            vaultStatusService.getVaults(userId)
        )
    }

    @GetMapping("/statuses")
    fun statuses(): ResponseEntity<List<VaultStatusResponseDto>> {
        return ResponseEntity.ok(
            vaultStatusService.getAllVaultStatuses()
        )
    }
}
