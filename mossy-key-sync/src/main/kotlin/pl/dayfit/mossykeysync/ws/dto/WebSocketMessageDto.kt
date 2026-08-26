package pl.dayfit.mossykeysync.ws.dto

import pl.dayfit.mossykeysync.type.MessageType
import java.util.UUID

sealed class WebSocketMessageDto {
    abstract val type: MessageType
    data class AuthFrame(val accessToken: String, val signature: String, val jwkPublicDh: Map<String, Any>) : WebSocketMessageDto() {
        override val type = MessageType.AUTH_FRAME
    }
    data class SignatureStatus(val signatureAccepted: Boolean) : WebSocketMessageDto() {
        override val type = MessageType.SIGNATURE_STATUS
    }
    data class KeySync(val ciphertext: String, val nonce: String, val signature: String, val vaultId: UUID) : WebSocketMessageDto() {
        override val type = MessageType.KEY_SYNC
    }
}