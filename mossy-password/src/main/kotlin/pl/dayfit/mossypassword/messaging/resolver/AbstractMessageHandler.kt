package pl.dayfit.mossypassword.messaging.resolver

import pl.dayfit.mossypassword.dto.vault.AbstractVaultRequestType
import pl.dayfit.mossypassword.dto.vault.AbstractVaultResponseType
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import kotlin.reflect.KClass

abstract class AbstractMessageHandler<Req : AbstractVaultRequestType, Res : AbstractVaultResponseType> {
    protected val pending = ConcurrentHashMap<UUID, CompletableFuture<VaultResponseMessageDto<Res>>>()

    abstract fun handleMessage(message: VaultRequestMessageDto<Req>)
            : CompletableFuture<VaultResponseMessageDto<Res>>

    abstract fun supportedType(): KClass<Req>

    fun handleResponse(requestId: UUID, response: VaultResponseMessageDto<Res>) {
        pending.remove(requestId)
            ?.complete(response)
    }
}