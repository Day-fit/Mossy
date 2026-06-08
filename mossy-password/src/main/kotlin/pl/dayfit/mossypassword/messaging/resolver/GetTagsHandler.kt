package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.GetTagsRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetTagsResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class GetTagsHandler(
    private val vaultMessagingService: VaultMessagingService
) : AbstractMessageHandler<GetTagsRequestType, GetTagsResponseType>() {
    companion object {
        private const val TOPIC = "get-tags"
    }

    override fun handleMessage(message: VaultRequestMessageDto<GetTagsRequestType>): CompletableFuture<VaultResponseMessageDto<GetTagsResponseType>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<GetTagsResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == GetTagsRequestType::class || type == GetTagsResponseType::class
    }
}