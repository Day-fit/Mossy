package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import pl.dayfit.mossypassword.dto.request.SaveNoteRequestDto
import pl.dayfit.mossypassword.service.NoteManagementService
import java.util.*

@RestController
class NoteController(
    private val noteManagementService: NoteManagementService
) {
    @GetMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun getNote(@PathVariable vaultId: UUID, @PathVariable passwordId: UUID, @AuthenticationPrincipal userId: UUID) {
        noteManagementService.getNoteContent(vaultId, passwordId, userId)
    }

    @PostMapping("/vault/{vaultId}/password/{passwordId}/note")
    fun saveNote(
        @PathVariable vaultId: UUID,
        @PathVariable passwordId: UUID,
        @AuthenticationPrincipal userId: UUID,
        @RequestBody @Valid note: SaveNoteRequestDto
    ) {
        noteManagementService.saveNote(vaultId, passwordId, userId, note.content)
    }
}