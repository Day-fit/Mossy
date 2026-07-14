package pl.dayfit.mossypassword.controller

import messaging.response.type.GetNoteResponseType
import messaging.response.type.SaveNoteResponseType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossypassword.dto.request.SaveNoteRequestDto
import pl.dayfit.mossypassword.service.NoteManagementService
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals

class NoteControllerTest {
    private val noteManagementService: NoteManagementService = mock()
    private val controller = NoteController(noteManagementService)

    @Test
    fun `get note forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        whenever(noteManagementService.getNoteContent(vaultId, passwordId, userId))
            .thenReturn(CompletableFuture.completedFuture(GetNoteResponseType("note")))

        val response = controller.getNote(vaultId, passwordId, jwtFor(userId)).get()

        assertEquals(200, response.statusCode.value())
        assertEquals("note", response.body?.content)
        verify(noteManagementService).getNoteContent(vaultId, passwordId, userId)
    }

    @Test
    fun `save note forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val request = SaveNoteRequestDto("note")
        whenever(noteManagementService.saveNote(vaultId, passwordId, userId, request.content))
            .thenReturn(CompletableFuture.completedFuture(SaveNoteResponseType()))

        val response = controller.saveNote(vaultId, passwordId, jwtFor(userId), request).get()

        assertEquals(204, response.statusCode.value())
        verify(noteManagementService).saveNote(vaultId, passwordId, userId, request.content)
    }

    private fun jwtFor(userId: UUID): Jwt = mock<Jwt>().also {
        whenever(it.subject).thenReturn(userId.toString())
    }
}
