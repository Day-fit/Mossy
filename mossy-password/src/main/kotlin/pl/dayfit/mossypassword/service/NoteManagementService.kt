package pl.dayfit.mossypassword.service

import messaging.request.type.GetNoteRequestType
import messaging.request.type.SaveNoteRequestType
import messaging.response.type.GetNoteResponseType
import messaging.response.type.SaveNoteResponseType
import org.springframework.stereotype.Service
import java.util.*
import java.util.concurrent.CompletableFuture

@Service
class NoteManagementService(
    private val vaultCommunicationService: VaultCommunicationService
) {
    fun getNoteContent(vaultId: UUID, passwordId: UUID, userId: UUID): CompletableFuture<GetNoteResponseType> {
        val request = GetNoteRequestType(passwordId)

        return vaultCommunicationService.handleProcessing(
            userId,
            vaultId,
            request
        )
    }

    fun saveNote(vaultId: UUID, passwordId: UUID, userId: UUID, note: String) {
        val request = SaveNoteRequestType(passwordId, note)

        vaultCommunicationService.handleProcessing<SaveNoteResponseType>(
            userId,
            vaultId,
            request
        )
    }
}