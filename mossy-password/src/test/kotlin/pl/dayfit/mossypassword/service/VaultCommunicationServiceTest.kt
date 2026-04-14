package pl.dayfit.mossypassword.service

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import type.VaultResponseStatus
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import pl.dayfit.mossypassword.configuration.RedisPrefix
import java.util.*
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class VaultCommunicationServiceTest {

    private val rabbitTemplate: RabbitTemplate = mock()
    private val redisTemplate: RedisTemplate<String, String> = mock()
    private val vaultMessageResolver: VaultMessageResolver = mock()
    private val valueOperations: ValueOperations<String, String> = mock()

    private val service = VaultCommunicationService(rabbitTemplate, redisTemplate, vaultMessageResolver)

    @Test
    fun `sendToVault routes to correct replica`() {
        val vaultId = UUID.randomUUID()
        val request = mock<AbstractVaultRequestType>()
        val message = VaultRequestMessageDto(UUID.randomUUID(), vaultId, request)

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.get("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId")).thenReturn("replica1")

        val expectedResponse = VaultResponseMessageDto(
            messageId = message.correlationId,
            status = VaultResponseStatus.OK,
            payload = mock<AbstractVaultResponseType>()
        )

        whenever(rabbitTemplate.convertSendAndReceive(
            eq("password.replica.exchange"),
            eq("replica1"),
            eq(message),
            any<org.springframework.amqp.core.MessagePostProcessor>()
        )).thenReturn(expectedResponse)

        val future = service.sendToVault(vaultId, message)

        assertNotNull(future)
        assertTrue(future.isDone)
    }
}
