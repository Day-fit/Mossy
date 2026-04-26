package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.AuthFrameStatus

data class AuthFrameResponseDto(
    val status: AuthFrameStatus,
    val message: String? = null
)