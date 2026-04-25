package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.MessageType
import java.util.UUID

sealed class WebSocketMessageDto {
    abstract val type: MessageType
    data class AuthFrame(val deviceId: UUID, val signature: String, val jwkPublicDh: Map<String, Any>) : WebSocketMessageDto() {
        override val type = MessageType.AUTH_FRAME
    }
    data class KeySync(val ciphertext: String, val nonce: String, val signature: String, val vaultId: UUID) : WebSocketMessageDto() {
        override val type = MessageType.KEY_SYNC
    }
}