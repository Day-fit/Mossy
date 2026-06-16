package messaging.request.type

import type.MessageType
import java.util.UUID

data class GetNoteRequestType(
    val passwordId: UUID,
    override val type: MessageType = MessageType.GET_NOTE,
) : VaultRequestType()