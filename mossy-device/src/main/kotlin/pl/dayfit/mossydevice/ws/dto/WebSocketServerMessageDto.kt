package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.ServerMessageType
import java.util.UUID

sealed class WebSocketServerMessageDto {
    abstract val type: ServerMessageType

    data class PeerDetails(val peerIdKey: String, val peerDhKey: String, val vaultId: UUID) : WebSocketServerMessageDto() {
        override val type = ServerMessageType.PEER_DETAILS
    }
}