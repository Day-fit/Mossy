package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.DeletePasswordRequestType
import messaging.response.type.DeletePasswordResponseType
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.ActionType
import type.VaultResponseStatus
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class DeletePasswordHandler(
    private val vaultMessagingService: VaultMessagingService,
    private val kafkaTemplate: KafkaTemplate<String, PasswordStatisticEvent>,
    private val vaultRepository: VaultRepository
) : AbstractMessageHandler<DeletePasswordRequestType, DeletePasswordResponseType>() {
    @Value($$"${mossy.password.statistics.topic}")
    private lateinit var statisticTopic: String

    companion object {
        private const val TOPIC = "delete"
    }

    override fun handleMessage(message: VaultRequestMessageDto<DeletePasswordRequestType>): CompletableFuture<VaultResponseMessageDto<DeletePasswordResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<DeletePasswordResponseType>>()
        future.thenAccept { response ->
            val id = message.vaultId
            val vault = vaultRepository.findVaultById(id)
                .get()

            if (response.status != VaultResponseStatus.OK)
            {
                return@thenAccept
            }

            kafkaTemplate.send(statisticTopic, PasswordStatisticEvent(
                id,
                vault.ownerId,
                message.payload.passwordId,
                response.payload.domain!!,
                ActionType.REMOVED,
            ))
        }

        pending["${message.vaultId}:${message.messageId}"] = future

        vaultMessagingService.sendMessageToTopic(
            TOPIC,
            message
        )

        return future
    }

    override fun doSupport(type: KClass<*>): Boolean {
        return type == DeletePasswordRequestType::class || type == DeletePasswordResponseType::class
    }
}