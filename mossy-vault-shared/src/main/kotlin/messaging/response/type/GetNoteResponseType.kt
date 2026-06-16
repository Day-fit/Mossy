package messaging.response.type

import type.MessageType

data class GetNoteResponseType (
    val note: String?,
    override val type: MessageType = MessageType.GET_NOTE
) : VaultResponseType()