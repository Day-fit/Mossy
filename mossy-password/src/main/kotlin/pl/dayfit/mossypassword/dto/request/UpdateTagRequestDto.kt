package pl.dayfit.mossypassword.dto.request

import com.fasterxml.jackson.annotation.JsonProperty

data class UpdateTagRequestDto(
    @JsonProperty(required = false)
    val tagName: String,
    @JsonProperty(required = false)
    val color: String
)