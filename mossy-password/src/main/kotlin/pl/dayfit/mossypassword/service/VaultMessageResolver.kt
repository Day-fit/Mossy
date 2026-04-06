package pl.dayfit.mossypassword.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.vault.AbstractVaultRequestType
import pl.dayfit.mossypassword.dto.vault.AbstractVaultResponseType
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import pl.dayfit.mossypassword.messaging.resolver.AbstractMessageHandler
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Service
class VaultMessageResolver {
    private val messageHandlers: Map<KClass<out AbstractVaultRequestType>, AbstractMessageHandler<AbstractVaultRequestType, AbstractVaultResponseType>>

    @Autowired
    constructor(handlers: List<AbstractMessageHandler<AbstractVaultRequestType, AbstractVaultResponseType>>) {
        messageHandlers = handlers.associateBy { it.supportedType() }
    }

    fun resolve(message: VaultRequestMessageDto<AbstractVaultRequestType>): CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>> {
        return messageHandlers[message.type]
            ?.handleMessage(message)
            ?: throw IllegalArgumentException("Unsupported message type: ${message.type}")
    }
}