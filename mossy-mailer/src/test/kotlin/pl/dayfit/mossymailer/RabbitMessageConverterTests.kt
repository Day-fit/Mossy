package pl.dayfit.mossymailer

import mossymailershared.event.SendEmailCommand
import org.junit.jupiter.api.Test
import org.springframework.amqp.core.MessageProperties
import pl.dayfit.mossymailer.configuration.RabbitMqConfiguration
import kotlin.test.assertEquals

class RabbitMessageConverterTests {
    @Test
    fun `email command survives JSON conversion`() {
        val converter = RabbitMqConfiguration().messageConverter()
        val command = SendEmailCommand(
            commandId = "test-command",
            templateId = "test-template",
            recipient = "test@example.com",
            variables = mapOf("username" to "test")
        )

        val message = converter.toMessage(command, MessageProperties())

        assertEquals("application/json", message.messageProperties.contentType)
        assertEquals(command, converter.fromMessage(message))
    }
}
