package messaging

import messaging.response.type.AbstractVaultResponseType
import type.VaultResponseStatus
import java.util.UUID
import kotlin.reflect.KClass

data class VaultResponseMessageDto<out T: AbstractVaultResponseType>(
    val messageId: UUID,
    val payload: T,
    val status: VaultResponseStatus
) {
    val type: KClass<out T> = payload::class
}