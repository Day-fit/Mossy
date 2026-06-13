package messaging.request

import messaging.request.type.VaultRequestType
import java.util.UUID

data class VaultRequestMessageDto <out T: VaultRequestType> (
    val correlationId: UUID,
    val vaultId: UUID,
    val payload: T,
    val messageId: UUID = UUID.randomUUID(),
)