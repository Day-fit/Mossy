package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.DeleteTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.DeleteTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class DeleteTagHandler(
    private val vaultMessagingService: VaultMessagingService,
) : AbstractMessageHandler<DeleteTagRequestType, DeleteTagResponseType>() {
    override val supportedType: MessageType = MessageType.DELETE_TAG

    companion object {
        private const val TOPIC = "delete-tag"
    }

    override fun handleMessage(message: VaultRequestMessageDto<DeleteTagRequestType>): CompletableFuture<VaultResponseMessageDto<DeleteTagResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<DeleteTagResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }
}