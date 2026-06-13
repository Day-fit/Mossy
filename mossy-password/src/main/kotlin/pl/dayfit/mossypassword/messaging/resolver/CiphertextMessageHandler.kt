package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CiphertextRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CiphertextResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class CiphertextMessageHandler(
    private val vaultMessagingService: VaultMessagingService,
    override val supportedType: MessageType = MessageType.CIPHERTEXT_RETRIEVAL
) : AbstractMessageHandler<CiphertextRequestType, CiphertextResponseType>() {
    companion object {
        private const val TOPIC = "ciphertext"
    }

    override fun handleMessage(message: VaultRequestMessageDto<CiphertextRequestType>): CompletableFuture<VaultResponseMessageDto<CiphertextResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<CiphertextResponseType>>()

        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }
}