package pl.dayfit.mossymailer.service

import com.rabbitmq.client.Channel
import com.resend.Resend
import com.resend.core.exception.ResendException
import com.resend.core.net.RequestOptions
import com.resend.services.batch.Batch
import com.resend.services.batch.model.CreateBatchEmailsResponse
import com.resend.services.emails.model.CreateEmailOptions
import mossymailershared.event.SendEmailCommand
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.messaging.Message
import org.springframework.messaging.support.MessageBuilder
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry
import pl.dayfit.mossymailer.type.CommandStatus
import java.time.Duration
import kotlin.test.assertEquals

class MailerServiceTests {
    private val resend: Resend = mock()
    private val resendBatch: Batch = mock()
    private val channel: Channel = mock()
    private val redisTemplate: RedisTemplate<String, MailCommandStatusEntry> = mock()
    private val valueOperations: ValueOperations<String, MailCommandStatusEntry> = mock()

    private val service = MailerService(resend, redisTemplate)

    @Test
    fun `one send command sends exactly one message`() {
        val message = message()

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.setIfAbsent(eq(message.payload.commandId), any(), any<Duration>()))
            .thenReturn(true, false)
        whenever(valueOperations.get(message.payload.commandId)).thenReturn(
            MailCommandStatusEntry(message.payload.commandId, CommandStatus.SUCCESS)
        )
        whenever(resend.batch()).thenReturn(resendBatch)
        whenever(
            resendBatch.send(
                any<List<CreateEmailOptions>>(),
                any<RequestOptions>()
            )
        ).thenReturn(CreateBatchEmailsResponse(emptyList(), emptyList()))

        service.sendEmail(listOf(message), channel)
        service.sendEmail(listOf(message), channel)

        verify(resendBatch, times(1)).send(
            any<List<CreateEmailOptions>>(),
            any<RequestOptions>()
        )
        verify(channel, times(2)).basicAck(1L, false)
    }

    @Test
    fun `pending command is delayed without being sent`() {
        val message = message()

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.setIfAbsent(eq(message.payload.commandId), any(), any<Duration>()))
            .thenReturn(false)
        whenever(valueOperations.get(message.payload.commandId)).thenReturn(
            MailCommandStatusEntry(message.payload.commandId, CommandStatus.PENDING)
        )

        service.sendEmail(listOf(message), channel)

        verify(channel).basicNack(1L, false, false)
        verify(resend, never()).batch()
    }

    @ParameterizedTest
    @ValueSource(ints = [429, 500, 599])
    fun `retryable resend errors nack the message for delayed requeue`(statusCode: Int) {
        val message = message()

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.setIfAbsent(eq(message.payload.commandId), any(), any<Duration>()))
            .thenReturn(true)
        whenever(resend.batch()).thenReturn(resendBatch)
        whenever(
            resendBatch.send(
                any<List<CreateEmailOptions>>(),
                any<RequestOptions>()
            )
        ).thenThrow(ResendException(statusCode, "error"))

        service.sendEmail(listOf(message), channel)

        verify(channel).basicNack(1L, false, false)
        verify(channel, never()).basicAck(1L, false)
        verify(redisTemplate).delete(message.payload.commandId)
    }

    @Test
    fun `non-retryable resend errors mark the message failed without requeue`() {
        val message = message()

        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(valueOperations.setIfAbsent(eq(message.payload.commandId), any(), any<Duration>()))
            .thenReturn(true)
        whenever(resend.batch()).thenReturn(resendBatch)
        whenever(
            resendBatch.send(
                any<List<CreateEmailOptions>>(),
                any<RequestOptions>()
            )
        ).thenThrow(ResendException(400, "error"))

        service.sendEmail(listOf(message), channel)

        verify(channel).basicAck(1L, false)
        verify(channel, never()).basicNack(1L, false, false)
        assertSavedStatus(CommandStatus.FAILED)
    }

    private fun message(): Message<SendEmailCommand> = MessageBuilder
        .withPayload(
            SendEmailCommand(
                commandId = "command-id",
                templateId = "template-id",
                recipient = "recipient@example.com"
            )
        )
        .setHeader(AmqpHeaders.DELIVERY_TAG, 1L)
        .build()

    private fun assertSavedStatus(status: CommandStatus) {
        val entries = argumentCaptor<MailCommandStatusEntry>()
        verify(valueOperations).set(eq("command-id"), entries.capture(), any<Duration>())
        assertEquals(status, entries.firstValue.status)
    }
}
