package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CreateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CreateTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class CreateTagHandler(
    private val vaultMessagingService: VaultMessagingService,
    override val supportedType: MessageType = MessageType.CREATE_TAG
) : AbstractMessageHandler<CreateTagRequestType, CreateTagResponseType>() {
    companion object {
        private const val TOPIC = "save-tag"
    }

    override fun handleMessage(message: VaultRequestMessageDto<CreateTagRequestType>): CompletableFuture<VaultResponseMessageDto<CreateTagResponseType>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<CreateTagResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        return future
    }
}