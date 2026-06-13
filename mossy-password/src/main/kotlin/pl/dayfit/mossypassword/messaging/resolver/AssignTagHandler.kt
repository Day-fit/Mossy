package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.AssignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class AssignTagHandler(
    private val vaultMessagingService: VaultMessagingService,
    override val supportedType: MessageType = MessageType.ASSIGN_TAG,
) : AbstractMessageHandler<AssignTagRequestType, AssignTagResponseType>() {
    companion object {
        private const val TOPIC = "assign-tag"
    }

    override fun handleMessage(message: VaultRequestMessageDto<AssignTagRequestType>): CompletableFuture<VaultResponseMessageDto<AssignTagResponseType>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<AssignTagResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        return future
    }
}