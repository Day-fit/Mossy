package pl.dayfit.mossypassword.dto.request

import jakarta.validation.constraints.Size

data class SaveNoteRequestDto(
    @Size(max = 25000, message = "Note content cannot be longer than 25000 characters")
    val content: String,
)
