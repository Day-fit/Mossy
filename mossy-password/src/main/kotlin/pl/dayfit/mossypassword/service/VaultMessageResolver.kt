package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.type.AbstractVaultRequestType
import messaging.type.AbstractVaultResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.messaging.resolver.AbstractMessageHandler
import java.util.UUID
import java.util.concurrent.CompletableFuture

@Service
class VaultMessageResolver(
    private val messageHandlers: List<AbstractMessageHandler<AbstractVaultRequestType, AbstractVaultResponseType>>
) {
    fun resolve(message: VaultRequestMessageDto<AbstractVaultRequestType>): CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>> {
        return messageHandlers.filter { it.doSupport(message.type) }
            .getOrNull(0)
            ?.handleMessage(message)
            ?: throw IllegalArgumentException("Unsupported message type: ${message.type}")
    }

    fun handleResponse(vaultId: UUID, message: VaultResponseMessageDto<out AbstractVaultResponseType>) = messageHandlers.filter { it.doSupport(message.type) }
        .getOrNull(0)
        ?.handleResponse(message.messageId, vaultId, message)
        ?: throw IllegalArgumentException(
            "Unsupported response type: ${message.type}"
        )
}