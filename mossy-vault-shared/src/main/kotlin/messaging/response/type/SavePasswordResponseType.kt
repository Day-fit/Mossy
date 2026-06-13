package messaging.response.type

import type.MessageType
import java.util.UUID

class SavePasswordResponseType(
    val passwordId: UUID? = null,
    val domain: String? = null,
    override val type: MessageType = MessageType.SAVE_PASSWORD
) : VaultResponseType()