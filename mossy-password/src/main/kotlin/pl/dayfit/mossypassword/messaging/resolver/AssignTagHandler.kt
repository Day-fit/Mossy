package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.AssignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class AssignTagHandler(
    private val vaultMessagingService: VaultMessagingService,
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

    override fun doSupport(type: KClass<*>): Boolean {
        return type == AssignTagRequestType::class || type == AssignTagResponseType::class
    }
}