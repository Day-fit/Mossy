package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UpdateTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class UpdateTagHandler(
    private val vaultMessagingService: VaultMessagingService,
) : AbstractMessageHandler<UpdateTagRequestType, UpdateTagResponseType>() {
    override val supportedType: MessageType = MessageType.UPDATE_TAG

    companion object {
        private const val TOPIC = "update-tag"
    }

    override fun handleMessage(message: VaultRequestMessageDto<UpdateTagRequestType>): CompletableFuture<VaultResponseMessageDto<UpdateTagResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<UpdateTagResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }
}