package pl.dayfit.mossydevice.ws.dto

import java.util.UUID

sealed class FrameMessageDto {
    data class AuthFrame(val deviceId: UUID, val signature: String, val token: String) : FrameMessageDto()
    data class Message(val payload: Any) : FrameMessageDto() //TODO: Change when more messages are added
}