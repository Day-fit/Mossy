package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.GetNoteRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetNoteResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.MessageType
import java.util.concurrent.CompletableFuture

@Component
class GetNoteHandler(
    private val vaultMessagingService: VaultMessagingService
) : AbstractMessageHandler<GetNoteRequestType, GetNoteResponseType>() {
    override val supportedType: MessageType = MessageType.GET_NOTE

    companion object {
        private const val TOPIC = "get-note"
    }

    override fun handleMessage(message: VaultRequestMessageDto<GetNoteRequestType>): CompletableFuture<VaultResponseMessageDto<GetNoteResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<GetNoteResponseType>>()
        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }
}