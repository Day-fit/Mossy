package messaging.response.type

import type.MessageType
import java.util.UUID

class UpdatePasswordResponseType(
    val passwordId: UUID? = null,
    val address: String? = null,
    override val type: MessageType = MessageType.UPDATE_PASSWORD
) : VaultResponseType()
