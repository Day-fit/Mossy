package messaging.response

import messaging.response.type.VaultResponseType
import type.VaultResponseStatus
import java.util.UUID

data class VaultResponseMessageDto<out T: VaultResponseType>(
    val messageId: UUID,
    val payload: T,
    val status: VaultResponseStatus
)