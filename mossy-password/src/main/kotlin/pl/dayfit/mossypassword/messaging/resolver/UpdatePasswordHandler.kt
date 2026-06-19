package pl.dayfit.mossypassword.messaging.resolver

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdatePasswordRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UpdatePasswordResponseType
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.VaultMessagingService
import pl.dayfit.mossypassword.type.ActionType
import type.MessageType
import type.VaultResponseStatus
import java.util.concurrent.CompletableFuture

@Component
class UpdatePasswordHandler(
    private val vaultMessagingService: VaultMessagingService,
    private val kafkaTemplate: KafkaTemplate<String, PasswordStatisticEvent>,
    private val vaultRepository: VaultRepository,
    override val supportedType: MessageType = MessageType.UPDATE_PASSWORD
) : AbstractMessageHandler<UpdatePasswordRequestType, UpdatePasswordResponseType>() {
    @Value($$"${mossy.password.statistics.topic}")
    private lateinit var statisticTopic: String

    companion object {
        private const val TOPIC = "update"
    }

    override fun handleMessage(message: VaultRequestMessageDto<UpdatePasswordRequestType>): CompletableFuture<VaultResponseMessageDto<UpdatePasswordResponseType>> {
        val future = CompletableFuture<VaultResponseMessageDto<UpdatePasswordResponseType>>()
        future.thenAccept { response ->
            val id = message.vaultId
            val vault = vaultRepository.findVaultById(id)

            if (vault.isEmpty) {
                return@thenAccept
            }

            if (response.status != VaultResponseStatus.OK) {
                return@thenAccept
            }

            kafkaTemplate.send(
                statisticTopic,
                PasswordStatisticEvent(
                    id,
                    vault.get().ownerId,
                    response.payload.passwordId!!,
                    response.payload.address!!,
                    ActionType.UPDATED
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
}
