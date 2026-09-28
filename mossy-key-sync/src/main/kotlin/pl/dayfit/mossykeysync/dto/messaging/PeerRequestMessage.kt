package pl.dayfit.mossykeysync.dto.messaging

import java.util.UUID

data class PeerRequestMessage<T : Any>(
    val deviceId: UUID,
    val data: T,
)
