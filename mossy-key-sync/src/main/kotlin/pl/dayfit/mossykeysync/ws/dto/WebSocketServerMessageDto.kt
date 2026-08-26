package pl.dayfit.mossykeysync.ws.dto

import pl.dayfit.mossykeysync.type.ServerMessageType
import java.util.UUID

sealed class WebSocketServerMessageDto {
    abstract val type: ServerMessageType

    data class PeerDetails(
        val peerDeviceId: UUID,
        val peerDhKey: String,
        val signature: String,
        val vaultId: UUID
    ) : WebSocketServerMessageDto() {
        override val type = ServerMessageType.PEER_DETAILS
    }

    data class SignatureStatus(
        val signaturesAccepted: Boolean
    ) : WebSocketServerMessageDto() {
        override val type = ServerMessageType.SIGNATURE_STATUS
    }
}
