package pl.dayfit.mossypassword.messaging.resolver

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.MetadataRequestType
import messaging.response.type.MetadataResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class MetadataPasswordHandler(private val vaultMessagingService: VaultMessagingService) :
    AbstractMessageHandler<MetadataRequestType, MetadataResponseType>() {
    companion object {
        private const val TOPIC = "metadata"
    }

    override fun handleMessage(message: VaultRequestMessageDto<MetadataRequestType>): CompletableFuture<VaultResponseMessageDto<MetadataResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<MetadataResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == MetadataRequestType::class || type == MetadataResponseType::class
    }
}