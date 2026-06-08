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
import pl.dayfit.mossypassword.exception.VaultFailedException
import pl.dayfit.mossypassword.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.exception.VaultNotRespondedException
import pl.dayfit.mossypassword.exception.VaultResourceAlreadyExists
import pl.dayfit.mossypassword.helper.VaultHelper
import type.VaultResponseStatus
import java.util.*
import java.util.concurrent.CompletableFuture
import kotlin.NoSuchElementException

@Service
class VaultCommunicationService(
    private val asyncRabbitTemplate: AsyncRabbitTemplate,
    private val redisTemplate: RedisTemplate<String, String>,
    private val vaultMessageResolver: VaultMessageResolver,
    private val vaultHelper: VaultHelper,
) {
    @Suppress("UNCHECKED_CAST")
    fun <Res : AbstractVaultResponseType> handleProcessing(
        userId: UUID,
        vaultId: UUID,
        payload: AbstractVaultRequestType
    ): CompletableFuture<Res> {
        vaultHelper.requireOwnedConnectedVault(userId, vaultId)

        return sendToVault(
            vaultId,
            VaultRequestMessageDto(
                UUID.randomUUID(),
                vaultId,
                payload
            )
        ).thenApply {
            when (it.status) {
                VaultResponseStatus.OK -> it.payload
                VaultResponseStatus.ERROR -> throw VaultFailedException("Vault failed when processing request")
                VaultResponseStatus.NOT_FOUND -> throw NoSuchElementException("Vault couldn't find requested resource")
                VaultResponseStatus.ALREADY_EXISTS -> throw VaultResourceAlreadyExists("Vault already has requested resource")
            }
        } as CompletableFuture<Res>
    }

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