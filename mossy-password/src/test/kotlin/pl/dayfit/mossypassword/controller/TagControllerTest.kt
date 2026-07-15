package pl.dayfit.mossypassword.controller

import messaging.response.type.AssignTagResponseType
import messaging.response.type.CreateTagResponseType
import messaging.response.type.DeleteTagResponseType
import messaging.response.type.UnassignTagResponseType
import messaging.response.type.UpdateTagResponseType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossypassword.dto.request.AssignTagRequestDto
import pl.dayfit.mossypassword.dto.request.CreateTagRequestDto
import pl.dayfit.mossypassword.dto.request.UnassignTagRequestDto
import pl.dayfit.mossypassword.dto.request.UpdateTagRequestDto
import pl.dayfit.mossypassword.dto.response.GetTagsResponseDto
import pl.dayfit.mossypassword.service.TagManagementService
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals

class TagControllerTest {
    private val tagManagementService: TagManagementService = mock()
    private val controller = TagController(tagManagementService)

    @Test
    fun `create tag forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val request = CreateTagRequestDto(UUID.randomUUID(), "Personal", "#123456")
        whenever(tagManagementService.createTag(request, userId))
            .thenReturn(CompletableFuture.completedFuture(CreateTagResponseType(UUID.randomUUID())))

        assertEquals(201, controller.createTag(jwtFor(userId), request).get().statusCode.value())
        verify(tagManagementService).createTag(request, userId)
    }

    @Test
    fun `update and delete tag forward JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val tagId = UUID.randomUUID()
        val request = UpdateTagRequestDto("Work", "#654321")
        whenever(tagManagementService.updateTag(request, vaultId, userId, tagId))
            .thenReturn(CompletableFuture.completedFuture(UpdateTagResponseType()))
        whenever(tagManagementService.deleteTag(tagId, vaultId, userId))
            .thenReturn(CompletableFuture.completedFuture(DeleteTagResponseType()))

        assertEquals(200, controller.updateTag(jwtFor(userId), tagId, vaultId, request).get().statusCode.value())
        assertEquals(200, controller.deleteTag(jwtFor(userId), tagId, vaultId).get().statusCode.value())
        verify(tagManagementService).updateTag(request, vaultId, userId, tagId)
        verify(tagManagementService).deleteTag(tagId, vaultId, userId)
    }

    @Test
    fun `get tags forwards JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val vaultId = UUID.randomUUID()
        val tags = arrayOf(GetTagsResponseDto(UUID.randomUUID(), "Work", "#654321"))
        whenever(tagManagementService.getTagsFromVault(vaultId, userId))
            .thenReturn(CompletableFuture.completedFuture(tags))

        val response = controller.getTags(jwtFor(userId), vaultId).get()

        assertEquals(tags.toList(), response.body?.toList())
        verify(tagManagementService).getTagsFromVault(vaultId, userId)
    }

    @Test
    fun `assign and unassign tag forward JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val assignRequest = AssignTagRequestDto(UUID.randomUUID(), UUID.randomUUID())
        val unassignRequest = UnassignTagRequestDto(assignRequest.vaultId, assignRequest.tagId)
        whenever(tagManagementService.assignTag(assignRequest, userId, passwordId))
            .thenReturn(CompletableFuture.completedFuture(AssignTagResponseType()))
        whenever(tagManagementService.unassignTag(unassignRequest, userId, passwordId))
            .thenReturn(CompletableFuture.completedFuture(UnassignTagResponseType()))

        assertEquals(204, controller.assignTag(jwtFor(userId), assignRequest, passwordId).get().statusCode.value())
        assertEquals(204, controller.unassignTag(jwtFor(userId), unassignRequest, passwordId).get().statusCode.value())
        verify(tagManagementService).assignTag(assignRequest, userId, passwordId)
        verify(tagManagementService).unassignTag(unassignRequest, userId, passwordId)
    }

    private fun jwtFor(userId: UUID): Jwt = mock<Jwt>().also {
        whenever(it.subject).thenReturn(userId.toString())
    }
}
