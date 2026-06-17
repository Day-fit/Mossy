package messaging.request.type

import type.MessageType
import java.util.UUID

data class SaveNoteRequestType(
    val passwordId: UUID,
    val note: String,
    override val type: MessageType = MessageType.SAVE_NOTE,
) : VaultRequestType()
