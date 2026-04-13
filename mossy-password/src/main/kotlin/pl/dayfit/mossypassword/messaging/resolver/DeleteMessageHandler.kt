package pl.dayfit.mossypassword.messaging.resolver

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.DeletePasswordRequestType
import messaging.response.type.DeletePasswordResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class DeleteMessageHandler(
    private val vaultMessagingService: VaultMessagingService
) : AbstractMessageHandler<DeletePasswordRequestType, DeletePasswordResponseType>() {
    companion object {
        private const val TOPIC = "delete"
    }

    override fun handleMessage(message: VaultRequestMessageDto<DeletePasswordRequestType>): CompletableFuture<VaultResponseMessageDto<DeletePasswordResponseType>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<DeletePasswordResponseType>>()
        pending[message.correlationId.toString()] = future
        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == DeletePasswordRequestType::class
    }
}