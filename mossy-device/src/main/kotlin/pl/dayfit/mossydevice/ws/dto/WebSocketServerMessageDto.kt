package pl.dayfit.mossydevice.ws.dto

import pl.dayfit.mossydevice.type.ServerMessageType

sealed class WebSocketServerMessageDto {
    abstract val type: ServerMessageType

    data class PeerDetails(val peerIdKey: String, val peerDhKey: String) : WebSocketServerMessageDto() {
        override val type = ServerMessageType.PEER_DETAILS
    }
}