package pl.dayfit.mossykeysync.ws.dto

import pl.dayfit.mossykeysync.type.AuthFrameStatus

data class AuthFrameResponseDto(
    val status: AuthFrameStatus,
    val message: String? = null
)