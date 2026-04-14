package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.messaging.handler.annotation.Header
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.configuration.RedisPrefix
import java.util.*
import java.util.concurrent.CompletableFuture

@Service
class VaultCommunicationService(
    private val asyncRabbitTemplate: AsyncRabbitTemplate,
    private val redisTemplate: RedisTemplate<String, String>,
    private val vaultMessageResolver: VaultMessageResolver,
) {
    fun sendToVault(
        vaultId: UUID,
        message: VaultRequestMessageDto<AbstractVaultRequestType>
    ): CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>> {
        val replicaId = redisTemplate.opsForValue()
            .get("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId")

        val future = asyncRabbitTemplate.convertSendAndReceive<VaultResponseMessageDto<AbstractVaultResponseType>>(
            "password.replica.exchange",
            replicaId,
            message
        ) { msg ->
            msg.messageProperties.correlationId = message.correlationId.toString()
            msg
        }

        return future.toCompletableFuture()
    }

    @RabbitListener(queues = ["#{@replicaQueue.name}"])
    fun resolveMessage(
        message: VaultRequestMessageDto<AbstractVaultRequestType>,
        @Header(AmqpHeaders.REPLY_TO) replyTo: String
    ) {
        val future = vaultMessageResolver.resolve(message)

        future.thenAccept { response ->
            asyncRabbitTemplate.convertAndSend(
                "",
                replyTo,
                response
            ) {
                it.messageProperties.correlationId = message.correlationId.toString()
                it
            }
        }
    }
}