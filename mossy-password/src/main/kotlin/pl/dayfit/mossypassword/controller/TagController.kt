package pl.dayfit.mossypassword.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.request.AssignTagRequestDto
import pl.dayfit.mossypassword.dto.request.CreateTagRequestDto
import pl.dayfit.mossypassword.dto.response.GetTagsResponseDto
import pl.dayfit.mossypassword.service.TagManagementService
import java.net.URI
import java.util.UUID
import java.util.concurrent.CompletableFuture

@RestController
class TagController(
    private val tagManagementService: TagManagementService
) {
    @PostMapping("/tag")
    fun createTag(@AuthenticationPrincipal userId: UUID, @Valid requestDto: CreateTagRequestDto): CompletableFuture<ResponseEntity<Nothing>> {
        return tagManagementService.createTag(requestDto, userId).thenApply {
            if (it.tagId == null) {
                return@thenApply ResponseEntity.internalServerError()
                    .build()
            }

            return@thenApply ResponseEntity.created(URI("/api/v1/passwords/" + it.tagId))
                .build()
        }
    }

    @GetMapping("/vault/{vaultId}/tags")
    fun getTags(@AuthenticationPrincipal userId: UUID, @PathVariable vaultId: UUID): CompletableFuture<ResponseEntity<Array<GetTagsResponseDto>>> {
        return tagManagementService.getTagsFromVault(vaultId, userId).thenApply {
            ResponseEntity.ok(it)
        }
    }

    @PutMapping("/{passwordId}/tags")
    fun assignTag(@AuthenticationPrincipal userId: UUID, @Valid requestDto: AssignTagRequestDto, @PathVariable passwordId: UUID) {
        tagManagementService.assignTag(requestDto, userId, passwordId)
    }
}