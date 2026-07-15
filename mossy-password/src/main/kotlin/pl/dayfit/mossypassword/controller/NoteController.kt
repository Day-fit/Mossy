package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*
import pl.dayfit.mossypassword.dto.request.SaveNoteRequestDto
import pl.dayfit.mossypassword.dto.response.GetNoteResponseDto
import pl.dayfit.mossypassword.service.NoteManagementService
import java.util.*
import java.util.concurrent.CompletableFuture

@RestController
class NoteController(
    private val noteManagementService: NoteManagementService
) {
    @GetMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun getNote(@PathVariable vaultId: UUID, @PathVariable passwordId: UUID, @AuthenticationPrincipal jwt: Jwt): CompletableFuture<ResponseEntity<GetNoteResponseDto>> {
        val userId = UUID.fromString(jwt.subject)
        return noteManagementService.getNoteContent(vaultId, passwordId, userId).thenApply {
            return@thenApply ResponseEntity.ok(GetNoteResponseDto(it.note ?: ""))
        }
    }

    @PostMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun saveNote(
        @PathVariable vaultId: UUID,
        @PathVariable passwordId: UUID,
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody @Valid note: SaveNoteRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)

        return noteManagementService.saveNote(vaultId, passwordId, userId, note.content).thenApply {
            return@thenApply ResponseEntity.noContent().build()
        }
    }
}
