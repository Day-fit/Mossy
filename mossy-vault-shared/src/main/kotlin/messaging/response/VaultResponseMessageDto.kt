package messaging.response

import com.fasterxml.jackson.annotation.JsonIgnore
import messaging.response.type.AbstractVaultResponseType
import type.VaultResponseStatus
import java.util.UUID
import kotlin.reflect.KClass

data class VaultResponseMessageDto<out T: AbstractVaultResponseType>(
    val messageId: UUID,
    val payload: T,
    val status: VaultResponseStatus
) {
    @get:JsonIgnore
    val type: KClass<out T> = payload::class
}