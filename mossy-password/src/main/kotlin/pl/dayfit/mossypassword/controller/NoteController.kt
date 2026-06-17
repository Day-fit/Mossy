package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import messaging.response.type.GetNoteResponseType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import pl.dayfit.mossypassword.dto.request.SaveNoteRequestDto
import pl.dayfit.mossypassword.service.NoteManagementService
import java.util.*
import java.util.concurrent.CompletableFuture

@RestController
class NoteController(
    private val noteManagementService: NoteManagementService
) {
    @GetMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun getNote(@PathVariable vaultId: UUID, @PathVariable passwordId: UUID, @AuthenticationPrincipal userId: UUID): CompletableFuture<ResponseEntity<GetNoteResponseType>> {
        return noteManagementService.getNoteContent(vaultId, passwordId, userId).thenApply {
            return@thenApply ResponseEntity.ok(it)
        }
    }

    @PostMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun saveNote(
        @PathVariable vaultId: UUID,
        @PathVariable passwordId: UUID,
        @AuthenticationPrincipal userId: UUID,
        @RequestBody @Valid note: SaveNoteRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return noteManagementService.saveNote(vaultId, passwordId, userId, note.content).thenApply {
            return@thenApply ResponseEntity.noContent().build()
        }
    }
}