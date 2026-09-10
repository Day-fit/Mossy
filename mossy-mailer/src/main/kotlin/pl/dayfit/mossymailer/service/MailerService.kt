package pl.dayfit.mossymailer.service

import com.rabbitmq.client.Channel
import com.resend.Resend
import com.resend.core.exception.ResendException
import com.resend.core.net.RequestOptions
import com.resend.services.emails.model.CreateEmailOptions
import com.resend.services.emails.model.Template
import mossymailershared.event.SendEmailCommand
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.messaging.Message
import org.springframework.stereotype.Service
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry
import pl.dayfit.mossymailer.type.CommandStatus
import java.time.Duration

@Service
class MailerService(
    private val resend: Resend,
    private val redisTemplate: RedisTemplate<String, MailCommandStatusEntry>
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @RabbitListener(queues = ["mossy.email.queue"])
    fun sendEmail(
        batch: List<Message<SendEmailCommand>>,
        channel: Channel
    ) {
        val messagesToSend = buildList {
            batch.forEach { message ->
                val commandId = message.payload.commandId
                val acquired = redisTemplate.opsForValue().setIfAbsent(
                    commandId,
                    MailCommandStatusEntry(commandId, CommandStatus.PENDING),
                    PROCESSING_TTL
                ) == true

                if (acquired) {
                    add(message)
                } else {
                    when (redisTemplate.opsForValue().get(commandId)?.status) {
                        CommandStatus.PENDING, null ->
                            channel.basicNack(message.deliveryTag(), false, false)

                        CommandStatus.SUCCESS, CommandStatus.FAILED ->
                            channel.basicAck(message.deliveryTag(), false)
                    }
                }
            }
        }

        if (messagesToSend.isEmpty()) {
            return
        }

        val response = try {
            resend.batch().send(
                messagesToSend.map {
                    val payload = it.payload
                    CreateEmailOptions.builder()
                        .from("Mossy <noreply@dayfit.pl>")
                        .to(payload.recipient)
                        .template(
                            Template.builder()
                                .id(payload.templateId)
                                .variables(payload.variables)
                                .build()
                        )
                        .build()
                }, RequestOptions.builder()
                    .add("x-batch-validation", "permissive")
                    .build()
            )
        } catch (ex: ResendException) {
            val statusCode = ex.statusCode
            val shouldRetry = statusCode == 429 || statusCode != null && statusCode in 500..599

            messagesToSend.forEach {
                if (shouldRetry) {
                    redisTemplate.delete(it.payload.commandId)
                    channel.basicNack(it.deliveryTag(), false, false)
                } else {
                    saveStatus(it, CommandStatus.FAILED)
                    channel.basicAck(it.deliveryTag(), false)
                }
            }

            logger.warn("Error while sending email batch", ex)
            return
        }

        val failedIndexes = response.errors.mapTo(mutableSetOf()) { error ->
            val failed = messagesToSend[error.index]
            saveStatus(failed, CommandStatus.FAILED)
            channel.basicAck(failed.deliveryTag(), false)
            logger.warn("Error while sending email: ${error.message}")
            error.index
        }

        messagesToSend.forEachIndexed { index, message ->
            if (index !in failedIndexes) {
                saveStatus(message, CommandStatus.SUCCESS)
                channel.basicAck(message.deliveryTag(), false)
            }
        }
    }

    private fun saveStatus(message: Message<SendEmailCommand>, status: CommandStatus) {
        val commandId = message.payload.commandId
        redisTemplate.opsForValue().set(
            commandId,
            MailCommandStatusEntry(commandId, status),
            STATUS_TTL
        )
    }

    private fun Message<SendEmailCommand>.deliveryTag() =
        headers[AmqpHeaders.DELIVERY_TAG] as Long

    private companion object {
        val PROCESSING_TTL: Duration = Duration.ofMinutes(2)
        val STATUS_TTL: Duration = Duration.ofMinutes(5)
    }
}
