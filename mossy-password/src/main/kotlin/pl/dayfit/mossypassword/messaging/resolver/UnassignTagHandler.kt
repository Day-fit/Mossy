package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UnassignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UnassignTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class UnassignTagHandler(
    private val vaultMessagingService: VaultMessagingService,
    override val supportedType: MessageType = MessageType.UNASSIGN_TAG,
) : AbstractMessageHandler<UnassignTagRequestType, UnassignTagResponseType>() {
    companion object {
        private const val TOPIC = "unassign-tag"
    }

    override fun handleMessage(message: VaultRequestMessageDto<UnassignTagRequestType>): CompletableFuture<VaultResponseMessageDto<UnassignTagResponseType>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<UnassignTagResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        return future
    }
}

