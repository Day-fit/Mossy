package pl.dayfit.mossypassword.service

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.VaultRequestType
import messaging.response.type.VaultResponseType
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.messaging.resolver.AbstractMessageHandler
import java.util.UUID
import java.util.concurrent.CompletableFuture

@Service
class VaultMessageResolver(
    private val messageHandlers: List<AbstractMessageHandler<out VaultRequestType, out VaultResponseType>>
) {
    @Suppress("UNCHECKED_CAST")
    fun resolve(message: VaultRequestMessageDto<VaultRequestType>): CompletableFuture<VaultResponseMessageDto<VaultResponseType>> {
        return messageHandlers.filter { it.doSupport(message.payload.type) }
            .getOrNull(0)
            ?.let { handler ->
                (handler as AbstractMessageHandler<VaultRequestType, VaultResponseType>)
                    .handleMessage(message)
            }
            ?: throw IllegalArgumentException("Unsupported message type: ${message.payload.type}")
    }

    @Suppress("UNCHECKED_CAST")
    fun handleResponse(vaultId: UUID, message: VaultResponseMessageDto<VaultResponseType>) =
        messageHandlers.filter { it.doSupport(message.payload.type) }
            .getOrNull(0)
            ?.let { handler ->
                (handler as AbstractMessageHandler<VaultRequestType, VaultResponseType>)
                    .handleResponse(message.messageId, vaultId, message)
            }
            ?: throw IllegalArgumentException(
                "Unsupported response type: ${message.payload.type}"
            )
}