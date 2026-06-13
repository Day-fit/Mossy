package pl.dayfit.mossypassword.dto.response

import java.util.UUID

data class GetTagsResponseDto(
    val tagId: UUID,
    val tagName: String,
    val color: String
)
