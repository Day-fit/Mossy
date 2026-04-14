package messaging

import com.fasterxml.jackson.annotation.JsonIgnore
import messaging.request.type.AbstractVaultRequestType
import java.util.UUID
import kotlin.reflect.KClass

data class VaultRequestMessageDto <out T: AbstractVaultRequestType> (
    val correlationId: UUID,
    val vaultId: UUID,
    val payload: T,
    val messageId: UUID = UUID.randomUUID(),
) {
    @get:JsonIgnore
    val type: KClass<out T> = payload::class
}