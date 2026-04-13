package pl.dayfit.mossypassword.messaging.resolver

import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultRequestType
import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultResponseType
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import kotlin.reflect.KClass

abstract class AbstractMessageHandler<Req : AbstractVaultRequestType, Res : AbstractVaultResponseType> {
    protected val pending = ConcurrentHashMap<String, CompletableFuture<VaultResponseMessageDto<Res>>>()

    abstract fun handleMessage(message: VaultRequestMessageDto<Req>)
            : CompletableFuture<VaultResponseMessageDto<Res>>

    abstract fun doSupport(type: KClass<*>): Boolean

    fun handleResponse(requestId: UUID, vaultId: UUID, response: VaultResponseMessageDto<out AbstractVaultResponseType>) {
        pending.remove("$vaultId:$requestId")
            ?.complete(response)
    }
}