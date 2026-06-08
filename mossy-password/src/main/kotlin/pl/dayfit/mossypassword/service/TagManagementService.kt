package pl.dayfit.mossypassword.service

import messaging.request.type.AssignTagRequestType
import messaging.request.type.CreateTagRequestType
import messaging.request.type.GetTagsRequestType
import messaging.response.type.AssignTagResponseType
import messaging.response.type.CreateTagResponseType
import messaging.response.type.GetTagsResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.AssignTagRequestDto
import pl.dayfit.mossypassword.dto.request.CreateTagRequestDto
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

    fun assignTag(requestDto: AssignTagRequestDto, userId: UUID, passwordId: UUID) {
        vaultCommunicationService.handleProcessing<AssignTagResponseType>(
            userId,
            requestDto.vaultId,
            AssignTagRequestType(
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
