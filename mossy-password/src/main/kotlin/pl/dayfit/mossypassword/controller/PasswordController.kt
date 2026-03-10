package pl.dayfit.mossypassword.controller

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.service.VaultCommunicationService
import java.util.UUID

@RestController
@RequestMapping("/password")
class PasswordController(
    private val vaultCommunicationService: VaultCommunicationService
) {
    /**
     * Saves a password by forwarding it to the vault specified in the request DTO.
     *
     * @param requestDto the data transfer object containing the password details and destination vaultId.
     * @return a ResponseEntity containing a ServerResponseDto with a success message.
     */
    @PostMapping("/save")
    fun savePassword(
        @RequestBody requestDto: SavePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        val vaultId = UUID.fromString(requestDto.vaultId)
        vaultCommunicationService.savePassword(vaultId, requestDto)

        return ResponseEntity.ok(
            ServerResponseDto("Passwords saved successfully")
        )
    }

    @PostMapping("/extract-ciphertext")
    fun extractCiphertext(
        @RequestBody requestDto: ExtractCiphertextRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.extractCiphertext(
            requestDto.vaultId,
            requestDto.passwordId
        )

        return ResponseEntity.ok(
            ServerResponseDto("Ciphertext extraction requested successfully")
        )
    }

    @PatchMapping("/update")
    fun updatePassword(
        @RequestBody requestDto: UpdatePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {
        vaultCommunicationService.updatePassword(requestDto)

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
        @RequestBody deletePasswordRequestDto: DeletePasswordRequestDto
    ): ResponseEntity<ServerResponseDto> {

        vaultCommunicationService.deletePassword(
            deletePasswordRequestDto.vaultId,
            deletePasswordRequestDto.passwordId
        )

        return ResponseEntity.ok(
            ServerResponseDto("Passwords deleted successfully")
        )
    }
}