package pl.dayfit.mossypassword.messaging.resolver

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import kotlin.reflect.KClass

abstract class AbstractMessageHandler<Req : AbstractVaultRequestType, Res : AbstractVaultResponseType> {
    protected val pending = ConcurrentHashMap<String, CompletableFuture<VaultResponseMessageDto<Res>>>()

    abstract fun handleMessage(message: VaultRequestMessageDto<Req>)
            : CompletableFuture<VaultResponseMessageDto<Res>>

    abstract fun doSupport(type: KClass<*>): Boolean

    fun handleResponse(requestId: UUID, vaultId: UUID, response: VaultResponseMessageDto<Res>) {
        pending.remove("$vaultId:$requestId")
            ?.complete(response)
    }
}