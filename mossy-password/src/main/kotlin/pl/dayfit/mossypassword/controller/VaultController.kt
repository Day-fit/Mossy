package pl.dayfit.mossypassword.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.request.VaultRegistrationRequestDto
import pl.dayfit.mossypassword.dto.request.VaultUpdateRequestDto
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.dto.response.CreateVaultResponseDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.service.VaultAuthService
import pl.dayfit.mossypassword.service.VaultStatusService
import java.util.UUID
import org.springframework.web.bind.annotation.PathVariable

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
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody vaultRegistrationRequestDto: VaultRegistrationRequestDto
    ): ResponseEntity<VaultRegistrationResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        return ResponseEntity.ok(
            vaultAuthService.register(userId, vaultRegistrationRequestDto)
        )
    }

    /**
     * Creates a new vault and returns the vault ID and API key along with a success message.
     * This is the primary endpoint for vault creation.
     */
    @PostMapping
    fun createVault(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody vaultRegistrationRequestDto: VaultRegistrationRequestDto
    ): ResponseEntity<CreateVaultResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        val registrationResponse = vaultAuthService.register(userId, vaultRegistrationRequestDto)
        return ResponseEntity.ok(
            CreateVaultResponseDto(
                vaultId = registrationResponse.vaultId,
                apiKey = registrationResponse.apiKey,
                message = "Vault created successfully"
            )
        )
    }

    @GetMapping("/vaults")
    fun getVaults(
        @AuthenticationPrincipal jwt: Jwt
    ): ResponseEntity<List<VaultStatusResponseDto>> {
        val userId = UUID.fromString(jwt.subject)
        return ResponseEntity.ok(
            vaultStatusService.getVaultsStatuses(userId)
        )
    }

    @GetMapping("/statuses")
    fun statuses(
        @AuthenticationPrincipal jwt: Jwt
    ): ResponseEntity<List<VaultStatusResponseDto>> {
        val userId = UUID.fromString(jwt.subject)
        return ResponseEntity.ok(
            vaultStatusService.getVaultsStatuses(userId)
        )
    }

    @DeleteMapping("/{vaultId}")
    fun deleteVault(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable vaultId: UUID
    ): ResponseEntity<ServerResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        return ResponseEntity.ok(vaultAuthService.delete(userId, vaultId))
    }

    @PutMapping("/{vaultId}")
    fun updateVault(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable vaultId: UUID,
        @RequestBody requestDto: VaultUpdateRequestDto
    ): ResponseEntity<ServerResponseDto> {
        val userId = UUID.fromString(jwt.subject)
        return ResponseEntity.ok(vaultAuthService.update(userId, vaultId, requestDto))
    }
}
