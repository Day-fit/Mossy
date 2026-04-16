package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.SavePasswordRequestType
import messaging.response.type.SavePasswordResponseType
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.VaultMessagingService
import type.ActionType
import type.PasswordSaveType
import type.VaultResponseStatus
import java.util.concurrent.CompletableFuture
import kotlin.reflect.KClass

@Component
class SavePasswordHandler(
    private val vaultMessagingService: VaultMessagingService,
    private val kafkaTemplate: KafkaTemplate<String, PasswordStatisticEvent>,
    private val vaultRepository: VaultRepository
) : AbstractMessageHandler<SavePasswordRequestType, SavePasswordResponseType>() {
    @Value($$"${mossy.password.statistics.topic}")
    private lateinit var statisticTopic: String

    companion object {
        private const val TOPIC = "save"
    }

    override fun handleMessage(message: VaultRequestMessageDto<SavePasswordRequestType>): CompletableFuture<VaultResponseMessageDto<SavePasswordResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<SavePasswordResponseType>>()
        future.thenAccept { response ->
            val id = message.vaultId
            val vault = vaultRepository.findVaultById(id)

            if (vault.isEmpty) {
                return@thenAccept
            }

            if (response.status != VaultResponseStatus.OK) {
                return@thenAccept
            }

            val actionType = if (message.payload.saveType == PasswordSaveType.SAVE) ActionType.ADDED
                else ActionType.UPDATED

            kafkaTemplate.send(
                statisticTopic,
                PasswordStatisticEvent(
                    id,
                    vault.get().ownerId,
                    response.payload.passwordId!!,
                    response.payload.domain!!,
                    actionType
                )
            )
        }

        pending["${message.vaultId}:${message.messageId}"] = future

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