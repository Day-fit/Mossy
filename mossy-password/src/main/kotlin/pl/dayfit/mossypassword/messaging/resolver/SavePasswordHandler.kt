package pl.dayfit.mossypassword.messaging.resolver

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.SavePasswordRequestType
import messaging.response.type.SavePasswordResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class SavePasswordHandler(private val vaultMessagingService: VaultMessagingService) : AbstractMessageHandler<SavePasswordRequestType, SavePasswordResponseType>() {
    companion object {
        private const val TOPIC = "save"
    }

    override fun handleMessage(message: VaultRequestMessageDto<SavePasswordRequestType>): CompletableFuture<VaultResponseMessageDto<SavePasswordResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<SavePasswordResponseType>>()
        pending[message.correlationId.toString()] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == SavePasswordRequestType::class || type == SavePasswordResponseType::class
    }
}