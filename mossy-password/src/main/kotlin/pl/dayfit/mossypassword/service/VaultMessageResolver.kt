package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.messaging.resolver.AbstractMessageHandler
import java.util.UUID
import java.util.concurrent.CompletableFuture

@Service
class VaultMessageResolver(
    private val messageHandlers: List<AbstractMessageHandler<out AbstractVaultRequestType, out AbstractVaultResponseType>>
) {
    @Suppress("UNCHECKED_CAST")
    fun resolve(message: VaultRequestMessageDto<AbstractVaultRequestType>): CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>> {
        return messageHandlers.filter { it.doSupport(message.type) }
            .getOrNull(0)
            ?.let { handler ->
                (handler as AbstractMessageHandler<AbstractVaultRequestType, AbstractVaultResponseType>)
                    .handleMessage(message)
            }
            ?: throw IllegalArgumentException("Unsupported message type: ${message.type}")
    }

    @Suppress("UNCHECKED_CAST")
    fun handleResponse(vaultId: UUID, message: VaultResponseMessageDto<AbstractVaultResponseType>) =
        messageHandlers.filter { it.doSupport(message.type) }
            .getOrNull(0)
            ?.let { handler ->
                (handler as AbstractMessageHandler<AbstractVaultRequestType, AbstractVaultResponseType>)
                    .handleResponse(message.messageId, vaultId, message)
            }
            ?: throw IllegalArgumentException(
                "Unsupported response type: ${message.type}"
            )
}