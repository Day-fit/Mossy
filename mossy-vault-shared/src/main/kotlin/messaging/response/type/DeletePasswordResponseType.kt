package messaging.response.type

import type.MessageType
import java.util.UUID

data class DeletePasswordResponseType(
    val domain: String? = null,
    val passwordId: UUID? = null,
    override val type: MessageType = MessageType.DELETE_PASSWORD
) : VaultResponseType()