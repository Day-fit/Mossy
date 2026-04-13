package pl.dayfit.mossypassword.messaging.resolver

import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import pl.dayfit.mossypassword.dto.vault.request.DeletePasswordRequest
import pl.dayfit.mossypassword.dto.vault.response.DeletePasswordResponse
import pl.dayfit.mossypassword.service.VaultMessagingService
import java.util.concurrent.CompletableFuture

@Component
class DeleteMessageHandler(
    private val vaultMessagingService: VaultMessagingService
) : AbstractMessageHandler<DeletePasswordRequest, DeletePasswordResponse>() {
    companion object {
        private const val TOPIC = "delete"
    }

    override fun handleMessage(message: VaultRequestMessageDto<DeletePasswordRequest>): CompletableFuture<VaultResponseMessageDto<DeletePasswordResponse>> {
        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        val future = CompletableFuture<VaultResponseMessageDto<DeletePasswordResponse>>()
        pending[message.correlationId] = future
        return future
    }

    override fun supportedType() = DeletePasswordRequest::class
}