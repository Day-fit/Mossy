package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CreateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CreateTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class CreateTagHandler(
    private val vaultMessagingService: VaultMessagingService,
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

    override fun doSupport(type: KClass<*>): Boolean {
        return type == CreateTagRequestType::class || type == CreateTagResponseType::class
    }
}