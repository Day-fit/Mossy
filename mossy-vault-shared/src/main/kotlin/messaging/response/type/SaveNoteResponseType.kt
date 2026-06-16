package messaging.response.type

import type.MessageType

class SaveNoteResponseType(override val type: MessageType = MessageType.SAVE_NOTE) : VaultResponseType()