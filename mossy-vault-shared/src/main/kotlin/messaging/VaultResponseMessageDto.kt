package messaging

import messaging.response.type.AbstractVaultResponseType
import type.VaultResponseStatus
import java.util.UUID
import kotlin.reflect.KClass

data class VaultResponseMessageDto<T: AbstractVaultResponseType>(
    val messageId: UUID,
    val type: KClass<T>,
    val payload: T,
    val status: VaultResponseStatus
)