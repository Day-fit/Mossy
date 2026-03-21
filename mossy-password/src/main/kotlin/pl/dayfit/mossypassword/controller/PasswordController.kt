package pl.dayfit.mossypassword.controller

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.response.PasswordMetadataDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService
import pl.dayfit.mossypassword.service.VaultCommunicationService
import java.util.UUID

@RestController
class PasswordController(
    private val vaultCommunicationService: VaultCommunicationService,
    private val passwordQueryService: PasswordQueryService
) {
    /**
     * Saves a password by forwarding it to the vault specified in the request DTO.
     *
     * @param requestDto the data transfer object containing the password details and destination vaultId.
     * @return a ResponseEntity containing a ServerResponseDto with a success message.
     */
    @PostMapping("/save")
    fun savePassword(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody requestDto: SavePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.savePassword(userId, requestDto)

        return ResponseEntity.ok(
            ServerResponseDto("Password save request accepted")
        )
    }

    @PatchMapping("/update")
    fun updatePassword(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody requestDto: UpdatePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.updatePassword(userId, requestDto)

        return ResponseEntity
            .status(HttpStatus.OK)
            .body(ServerResponseDto("Password updated successfully"))
    }

    /**
     * Deletes a password from the specified vault based on the provided request details.
     *
     * @param deletePasswordRequestDto the data transfer object containing the unique identifiers
     * for the vault and the password to be deleted.
     * @return a ResponseEntity containing a ServerResponseDto with a success message upon successful deletion.
     */
    @DeleteMapping("/delete")
    fun deletePassword(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody deletePasswordRequestDto: DeletePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.deletePassword(
            userId,
            deletePasswordRequestDto.vaultId,
            deletePasswordRequestDto.passwordId
        )

        return ResponseEntity.ok(
            ServerResponseDto("Password deleted successfully")
        )
    }

    @PostMapping("/extract-ciphertext")
    fun extractCiphertext(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody requestDto: ExtractCiphertextRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.extractCiphertext(userId, requestDto.vaultId, requestDto.passwordId)

        return ResponseEntity.ok(
            ServerResponseDto("Ciphertext extraction requested successfully")
        )
    }

    /**
     * Gets password metadata for a vault.
     *
     * @param domain optional domain to filter passwords by.
     * @param vaultId the UUID of the vault.
     * @return a ResponseEntity containing password metadata without ciphertext.
     */
    @GetMapping("/metadata", "/uuids")
    fun getPasswordsMetadata(
        @AuthenticationPrincipal userId: UUID,
        @RequestParam(required = false) domain: String?,
        @RequestParam vaultId: String
    ): ResponseEntity<List<PasswordMetadataDto>> {
        val vaultUuid = UUID.fromString(vaultId)

        val passwords = passwordQueryService.getPasswordsMetadata(userId, vaultUuid, domain)
        return ResponseEntity.ok(passwords)
    }

    /**
     * Gets the ciphertext for a specific password UUID.
     *
     * @param passwordId the UUID of the password.
     * @param vaultId the UUID of the vault.
     * @return a ResponseEntity containing the ciphertext.
     */
    @GetMapping("/ciphertext/{passwordId}")
    fun getCiphertext(
        @AuthenticationPrincipal userId: UUID,
        @PathVariable passwordId: UUID,
        @RequestParam vaultId: String
    ): ResponseEntity<Map<String, String>> {
        val vaultUuid = UUID.fromString(vaultId)

        val ciphertext = passwordQueryService.getCiphertext(userId, vaultUuid, passwordId)
        return if (ciphertext != null) {
            ResponseEntity.ok(mapOf("ciphertext" to ciphertext))
        } else {
            ResponseEntity.notFound().build()
        }
    }
}