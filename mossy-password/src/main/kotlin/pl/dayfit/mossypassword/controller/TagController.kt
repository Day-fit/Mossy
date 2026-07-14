package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
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
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody requestDto: CreateTagRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)
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
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable tagId: UUID,
        @PathVariable vaultId: UUID,
        @Valid @RequestBody requestDto: UpdateTagRequestDto
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)
        return tagManagementService.updateTag(requestDto, vaultId, userId, tagId).thenApply {
            return@thenApply ResponseEntity.ok()
                .build()
        }
    }

    @DeleteMapping("/vault/{vaultId}/tag/{tagId}")
    fun deleteTag(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable tagId: UUID,
        @PathVariable vaultId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)
        return tagManagementService.deleteTag(tagId, vaultId, userId).thenApply {
            return@thenApply ResponseEntity.ok()
                .build()
        }
    }

    @GetMapping("/vault/{vaultId}/tags")
    fun getTags(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable vaultId: UUID
    ): CompletableFuture<ResponseEntity<Array<GetTagsResponseDto>>> {
        val userId = UUID.fromString(jwt.subject)
        return tagManagementService.getTagsFromVault(vaultId, userId).thenApply {
            ResponseEntity.ok(it)
        }
    }

    @PutMapping("/{passwordId}/tags")
    fun assignTag(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody requestDto: AssignTagRequestDto,
        @PathVariable passwordId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)
        return tagManagementService.assignTag(requestDto, userId, passwordId).thenApply {
            return@thenApply ResponseEntity.noContent()
                .build()
        }
    }

    @DeleteMapping("/{passwordId}/tags")
    fun unassignTag(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody requestDto: UnassignTagRequestDto,
        @PathVariable passwordId: UUID
    ): CompletableFuture<ResponseEntity<Nothing>> {
        val userId = UUID.fromString(jwt.subject)
        return tagManagementService.unassignTag(requestDto, userId, passwordId).thenApply {
            return@thenApply ResponseEntity.noContent()
                .build()
        }
    }
}
