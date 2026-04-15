package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CiphertextRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CiphertextResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class CiphertextMessageHandler(
    private val vaultMessagingService: VaultMessagingService,
) : AbstractMessageHandler<CiphertextRequestType, CiphertextResponseType>() {
    companion object {
        private const val TOPIC = "ciphertext"
    }

    override fun handleMessage(message: VaultRequestMessageDto<CiphertextRequestType>): CompletableFuture<VaultResponseMessageDto<CiphertextResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<CiphertextResponseType>>()

        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == CiphertextRequestType::class || type == CiphertextResponseType::class
    }
}