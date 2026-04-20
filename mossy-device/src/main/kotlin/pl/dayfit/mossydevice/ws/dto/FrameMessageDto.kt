package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.MessageType
import java.util.UUID

sealed class FrameMessageDto {
    abstract val type: MessageType
    data class AuthFrame(val deviceId: UUID, val signature: String) : FrameMessageDto() {
        override val type = MessageType.AUTH_FRAME
    }
    data class Message(val payload: Any) : FrameMessageDto() {
        override val type = MessageType.MESSAGE
    }//TODO: Change when more messages are added
}