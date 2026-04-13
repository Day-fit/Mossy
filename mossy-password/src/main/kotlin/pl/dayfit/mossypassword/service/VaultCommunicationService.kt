package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.messaging.handler.annotation.Header
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.configuration.RedisPrefix
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

@Service
class VaultCommunicationService(
    private val rabbitTemplate: RabbitTemplate,
    private val redisTemplate: RedisTemplate<String, String>,
    private val vaultMessageResolver: VaultMessageResolver,
) {
    private val pendingRequests: ConcurrentHashMap<String, CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>>> =
        ConcurrentHashMap()

    fun sendToVault(
        vaultId: UUID,
        message: VaultRequestMessageDto<AbstractVaultRequestType>
    ): CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>> {
        val replicaId = redisTemplate.opsForValue()
            .get("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId")

        rabbitTemplate.convertAndSend(
            "password.replica.exchange",
            replicaId,
            message
        ) {
            it.messageProperties.replyTo = "amq.rabbitmq.reply-to"
            it.messageProperties.correlationId = message.correlationId.toString()

            return@convertAndSend it
        }

        val future = CompletableFuture<VaultResponseMessageDto<AbstractVaultResponseType>>()
        pendingRequests[message.correlationId.toString()] = future
        return future
    }

    @RabbitListener(queues = ["#{@replicaQueue.name}"])
    fun handleMessageReply(
        response: VaultResponseMessageDto<AbstractVaultResponseType>,
        @Header(AmqpHeaders.CORRELATION_ID) correlationId: String
    ) {
        pendingRequests.remove(correlationId)
            ?.complete(response)
    }

    @RabbitListener(queues = ["#{@replicaQueue.name}"])
    fun resolveMessage(
        message: VaultRequestMessageDto<AbstractVaultRequestType>,
        @Header(AmqpHeaders.REPLY_TO) replyTo: String
    ) {
        val future = vaultMessageResolver.resolve(message)

        future.thenAccept { response ->
            rabbitTemplate.convertAndSend(
                "",
                replyTo,
                response
            ) {
                it.messageProperties.correlationId = message.correlationId.toString()
                return@convertAndSend it
            }
        }
    }
}