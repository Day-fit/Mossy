package pl.dayfit.mossycore.controller

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossycore.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossycore.dto.request.SavePasswordRequestDto
import pl.dayfit.mossycore.dto.response.ServerResponseDto
import pl.dayfit.mossycore.service.VaultCommunicationService
import java.security.Principal
import java.util.UUID

@RestController("/password")
class PasswordController(
    private val vaultCommunicationService: VaultCommunicationService
) {
    /**
     * Saves a password for the authenticated user.
     *
     * @param principal the currently authenticated principal containing the user ID.
     * @param requestDto the data transfer object containing the password details to be saved.
     * @return a ResponseEntity containing a ServerResponseDto with a success message.
     */
    @PostMapping("/save")
    fun savePassword(
        @AuthenticationPrincipal principal: Principal,
        requestDto: SavePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        val userId = UUID.fromString(principal.name)
        vaultCommunicationService.savePassword(userId, requestDto)

        return ResponseEntity.ok(
            ServerResponseDto("Password saved successfully")
        )
    }

    @PatchMapping("/update")
    fun updatePassword(): ResponseEntity<ServerResponseDto> {
        return ResponseEntity
            .status(HttpStatus.NOT_IMPLEMENTED)
            .body(ServerResponseDto("Not implemented yet"))
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
        @RequestBody deletePasswordRequestDto: DeletePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {

        vaultCommunicationService.deletePassword(
            deletePasswordRequestDto.vaultId,
            deletePasswordRequestDto.passwordId
        )

        return ResponseEntity.ok(
            ServerResponseDto("Password deleted successfully")
        )
    }
}