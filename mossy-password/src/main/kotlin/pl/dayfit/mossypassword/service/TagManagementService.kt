package pl.dayfit.mossypassword.service

import messaging.request.type.AssignTagRequestType
import messaging.request.type.CreateTagRequestType
import messaging.request.type.DeleteTagRequestType
import messaging.request.type.GetTagsRequestType
import messaging.request.type.UnassignTagRequestType
import messaging.request.type.UpdateTagRequestType
import messaging.response.type.AssignTagResponseType
import messaging.response.type.CreateTagResponseType
import messaging.response.type.DeleteTagResponseType
import messaging.response.type.GetTagsResponseType
import messaging.response.type.UnassignTagResponseType
import messaging.response.type.UpdateTagResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.AssignTagRequestDto
import pl.dayfit.mossypassword.dto.request.CreateTagRequestDto
import pl.dayfit.mossypassword.dto.request.UnassignTagRequestDto
import pl.dayfit.mossypassword.dto.request.UpdateTagRequestDto
import pl.dayfit.mossypassword.dto.response.GetTagsResponseDto
import java.util.UUID
import java.util.concurrent.CompletableFuture

@Service
class TagManagementService(
    private val vaultCommunicationService: VaultCommunicationService
) {
    fun createTag(requestDto: CreateTagRequestDto, userId: UUID): CompletableFuture<CreateTagResponseType> {
        return vaultCommunicationService.handleProcessing(
            userId,
            requestDto.vaultId,
            CreateTagRequestType(
                requestDto.tagName,
                requestDto.color
            )
        )
    }

    fun updateTag(requestDto: UpdateTagRequestDto, vaultId: UUID, userId: UUID, tagId: UUID): CompletableFuture<UpdateTagResponseType> {
        return vaultCommunicationService.handleProcessing(
            userId,
            vaultId,
            UpdateTagRequestType(
                tagId,
                requestDto.tagName,
                requestDto.color
            )
        )
    }

    fun deleteTag(tagId: UUID, vaultId: UUID, userId: UUID): CompletableFuture<DeleteTagResponseType> {
        return vaultCommunicationService.handleProcessing(
            userId,
            vaultId,
            DeleteTagRequestType(
                tagId
            )
        )
    }

    fun assignTag(requestDto: AssignTagRequestDto, userId: UUID, passwordId: UUID): CompletableFuture<AssignTagResponseType> {
        return vaultCommunicationService.handleProcessing(
            userId,
            requestDto.vaultId,
            AssignTagRequestType(
                passwordId,
                requestDto.tagId
            )
        )
    }

    fun unassignTag(requestDto: UnassignTagRequestDto, userId: UUID, passwordId: UUID): CompletableFuture<UnassignTagResponseType> {
        return vaultCommunicationService.handleProcessing(
            userId,
            requestDto.vaultId,
            UnassignTagRequestType(
                passwordId,
                requestDto.tagId
            )
        )
    }

    fun getTagsFromVault(vaultId: UUID, userId: UUID): CompletableFuture<Array<GetTagsResponseDto>> {
        return vaultCommunicationService.handleProcessing<GetTagsResponseType>(
            userId,
            vaultId,
            GetTagsRequestType()
        ).thenApply {
            return@thenApply it.tags.map { tag ->
                GetTagsResponseDto(
                    tag.tagId,
                    tag.tagName,
                    tag.color
                )
            }.toTypedArray()
        }
    }
}
