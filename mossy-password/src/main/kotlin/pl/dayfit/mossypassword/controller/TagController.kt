package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import pl.dayfit.mossypassword.dto.request.AssignTagRequestDto
import pl.dayfit.mossypassword.dto.request.CreateTagRequestDto
import pl.dayfit.mossypassword.dto.request.UnassignTagRequestDto
import pl.dayfit.mossypassword.dto.request.UpdateTagRequestDto
import pl.dayfit.mossypassword.dto.response.GetTagsResponseDto
import pl.dayfit.mossypassword.service.TagManagementService
import java.net.URI
import java.util.*
import java.util.concurrent.CompletableFuture

@RestController
class TagController(
    private val tagManagementService: TagManagementService
) {
    @PostMapping("/tag")
    fun createTag(
        @AuthenticationPrincipal userId: UUID,
        @Valid @RequestBody requestDto: CreateTagRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.createTag(requestDto, userId).thenApply {
            if (it.tagId == null) {
                return@thenApply ResponseEntity.internalServerError()
                    .build()
            }

            return@thenApply ResponseEntity.created(URI("/api/v1/passwords/vault/${requestDto.vaultId}/tags"))
                .build()
        }
    }

    @PatchMapping("/vault/{vaultId}/tag/{tagId}")
    fun updateTag(
        @AuthenticationPrincipal userId: UUID,
        @PathVariable tagId: UUID,
        @PathVariable vaultId: UUID,
        @Valid @RequestBody requestDto: UpdateTagRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.updateTag(requestDto, vaultId, userId, tagId).thenApply {
            return@thenApply ResponseEntity.ok()
                .build()
        }
    }

    @DeleteMapping("/vault/{vaultId}/tag/{tagId}")
    fun deleteTag(
        @AuthenticationPrincipal userId: UUID,
        @PathVariable tagId: UUID,
        @PathVariable vaultId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.deleteTag(tagId, vaultId, userId).thenApply {
            return@thenApply ResponseEntity.ok()
                .build()
        }
    }

    @GetMapping("/vault/{vaultId}/tags")
    fun getTags(
        @AuthenticationPrincipal userId: UUID,
        @PathVariable vaultId: UUID
    ): CompletableFuture<ResponseEntity<Array<GetTagsResponseDto>>> {
        return tagManagementService.getTagsFromVault(vaultId, userId).thenApply {
            ResponseEntity.ok(it)
        }
    }

    @PutMapping("/{passwordId}/tags")
    fun assignTag(
        @AuthenticationPrincipal userId: UUID,
        @Valid @RequestBody requestDto: AssignTagRequestDto,
        @PathVariable passwordId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.assignTag(requestDto, userId, passwordId).thenApply {
            return@thenApply ResponseEntity.noContent()
                .build()
        }
    }

    @DeleteMapping("/{passwordId}/tags")
    fun unassignTag(
        @AuthenticationPrincipal userId: UUID,
        @Valid @RequestBody requestDto: UnassignTagRequestDto,
        @PathVariable passwordId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.unassignTag(requestDto, userId, passwordId).thenApply {
            return@thenApply ResponseEntity.noContent()
                .build()
        }
    }
}