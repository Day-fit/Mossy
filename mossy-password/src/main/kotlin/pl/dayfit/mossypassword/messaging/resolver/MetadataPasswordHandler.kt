package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.MetadataRequestType
import messaging.response.type.MetadataResponseType
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.VaultResponseStatus
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class MetadataPasswordHandler(
    private val vaultMessagingService: VaultMessagingService,
    private val vaultRepository: VaultRepository
) : AbstractMessageHandler<MetadataRequestType, MetadataResponseType>() {
    companion object {
        private const val TOPIC = "metadata"
    }

    override fun handleMessage(message: VaultRequestMessageDto<MetadataRequestType>): CompletableFuture<VaultResponseMessageDto<MetadataResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<MetadataResponseType>>()
        future.thenAccept { response ->
            if (response.status != VaultResponseStatus.OK){
                return@thenAccept
            }

            val id = message.vaultId
            val vault = vaultRepository.findVaultById(id)
                .get()

            val passwordCount = response.payload.metadata.size
            if (vault.passwordCount == passwordCount) {
                return@thenAccept
            }

            vault.passwordCount = passwordCount
            vaultRepository.save(vault)
        }

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