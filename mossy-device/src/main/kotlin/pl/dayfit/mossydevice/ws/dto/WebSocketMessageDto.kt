package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.MessageType
import java.util.UUID

sealed class WebSocketMessageDto {
    abstract val type: MessageType
    data class AuthFrame(val deviceId: UUID, val signature: String, val publicDh: Map<String, Any>) : WebSocketMessageDto() {
        override val type = MessageType.AUTH_FRAME
    }
    data class KeySync(val cipherText: String) : WebSocketMessageDto() {
        override val type = MessageType.KEY_SYNC
    }
}