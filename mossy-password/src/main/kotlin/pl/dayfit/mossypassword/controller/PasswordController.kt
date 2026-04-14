package pl.dayfit.mossypassword.controller

import messaging.request.PasswordMetadataDto
import messaging.response.type.CiphertextResponseType
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
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.service.VaultManagementService
import java.util.UUID
import java.util.concurrent.CompletableFuture

@RestController
class PasswordController(
    private val vaultManagementService: VaultManagementService,
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
        vaultManagementService.savePassword(userId, requestDto)

        return ResponseEntity.ok(
            ServerResponseDto("Password save request accepted")
        )
    }

    @PatchMapping("/update")
    fun updatePassword(
        @AuthenticationPrincipal userId: UUID,
        @RequestBody requestDto: UpdatePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultManagementService.updatePassword(userId, requestDto)

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
        vaultManagementService.deletePassword(
            userId,
            deletePasswordRequestDto
        )

        return ResponseEntity.ok(
            ServerResponseDto("Password deleted successfully")
        )
    }

    /**
     * Gets password metadata for a vault.
     *
     * @param vaultId the UUID of the vault.
     * @return a ResponseEntity containing password metadata without ciphertext.
     */
    @GetMapping("/metadata")
    fun getPasswordsMetadata(
        @AuthenticationPrincipal userId: UUID,
        @RequestParam vaultId: UUID
    ): CompletableFuture<ResponseEntity<List<PasswordMetadataDto>>> {
        return vaultManagementService.getPasswordsMetadata(userId, vaultId).thenApply {
            ResponseEntity.ok(it.metadata)
        }
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
        @RequestParam vaultId: UUID
    ): CompletableFuture<ResponseEntity<CiphertextResponseType>> {
        return vaultManagementService.getPasswordCipherText(userId, vaultId, passwordId)
            .thenApply { ResponseEntity.ok(it) }
    }
}