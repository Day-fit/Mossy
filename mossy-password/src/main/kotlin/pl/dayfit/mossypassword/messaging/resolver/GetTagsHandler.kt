package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.GetTagsRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetTagsResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class GetTagsHandler(
    private val vaultMessagingService: VaultMessagingService,
    override val supportedType: MessageType = MessageType.GET_TAGS
) : AbstractMessageHandler<GetTagsRequestType, GetTagsResponseType>() {
    companion object {
        private const val TOPIC = "get-tags"
    }

    override fun handleMessage(message: VaultRequestMessageDto<GetTagsRequestType>): CompletableFuture<VaultResponseMessageDto<GetTagsResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<GetTagsResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }
}