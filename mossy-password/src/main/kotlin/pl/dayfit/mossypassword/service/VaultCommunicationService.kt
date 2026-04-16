package pl.dayfit.mossypassword.service

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import org.springframework.amqp.core.AmqpReplyTimeoutException
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.configuration.RedisPrefix
import pl.dayfit.mossypassword.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.exception.VaultNotRespondedException
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

        if (replicaId == null) {
            throw VaultNotConnectedException(vaultId)
        }

        try {
            val future = asyncRabbitTemplate.convertSendAndReceive<VaultResponseMessageDto<AbstractVaultResponseType>>(
                "password.replica.exchange",
                replicaId,
                message
            ) { msg ->
                msg.messageProperties.correlationId = message.correlationId.toString()
                msg
            }

            return future
        } catch (_: AmqpReplyTimeoutException) {
            throw VaultNotRespondedException("Vault $vaultId didn't respond in time.")
        } catch (e: Exception) {
            throw e
        }
    }

    @RabbitListener(
        queues = ["#{@replicaQueue.name}"]
    )
    fun resolveMessage(
        message: VaultRequestMessageDto<AbstractVaultRequestType>
    ): VaultResponseMessageDto<AbstractVaultResponseType> {
        return vaultMessageResolver.resolve(message)
            .get()
    }
}