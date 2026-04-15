package pl.dayfit.mossypassword.service
import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.AbstractVaultRequestType
import messaging.response.type.AbstractVaultResponseType
import type.VaultResponseStatus
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.RabbitConverterFuture
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import pl.dayfit.mossypassword.configuration.RedisPrefix
import java.util.*
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
class VaultCommunicationServiceTest {
    private val rabbitTemplate: AsyncRabbitTemplate = mock()
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

        val expectedResponse = mock<RabbitConverterFuture<VaultResponseMessageDto<AbstractVaultResponseType>>>()
        val responseMessage = VaultResponseMessageDto(
            messageId = message.correlationId,
            status = VaultResponseStatus.OK,
            payload = mock<AbstractVaultResponseType>()
        )
        whenever(expectedResponse.get()).thenReturn(responseMessage)
        whenever(expectedResponse.isDone).thenReturn(true)

        whenever(rabbitTemplate.convertSendAndReceive<VaultResponseMessageDto<AbstractVaultResponseType>>(
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