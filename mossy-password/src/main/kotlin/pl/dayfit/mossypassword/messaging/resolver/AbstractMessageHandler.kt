package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.VaultRequestType
import messaging.response.type.VaultResponseType
import type.MessageType
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

abstract class AbstractMessageHandler<Req : VaultRequestType, Res : VaultResponseType> {
    protected val pending = ConcurrentHashMap<String, CompletableFuture<VaultResponseMessageDto<Res>>>()
    protected abstract val supportedType: MessageType

    abstract fun handleMessage(message: VaultRequestMessageDto<Req>)
            : CompletableFuture<VaultResponseMessageDto<Res>>

    fun doSupport(type: MessageType): Boolean {
        return type == supportedType
    }

    fun handleResponse(requestId: UUID, vaultId: UUID, response: VaultResponseMessageDto<Res>) {
        pending.remove("$vaultId:$requestId")
            ?.complete(response)
    }
}