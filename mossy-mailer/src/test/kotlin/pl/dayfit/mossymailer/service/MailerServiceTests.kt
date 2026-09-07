package pl.dayfit.mossymailer.service

import com.resend.Resend
import com.resend.core.exception.ResendException
import com.resend.services.emails.Emails
import mossymailershared.event.SendEmailCommand
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry
import pl.dayfit.mossymailer.repository.MailerIdempotencyRepository
import pl.dayfit.mossymailer.type.CommandStatus
import java.util.Optional
import kotlin.test.assertEquals

class MailerServiceTests {
    private val resend: Resend = mock()
    private val resendEmail: Emails = mock()

    private val mailerIdempotencyRepository: MailerIdempotencyRepository = mock()

    private val service = MailerService(resend, mailerIdempotencyRepository)

    @Test
    fun `one send command sends exactly one message`() {
        val command = SendEmailCommand(
            commandId = "command-id",
            templateId = "template-id",
            recipient = "recipient@example.com"
        )

        whenever {
            resend.emails()
        }.thenReturn(resendEmail)
        whenever {
            mailerIdempotencyRepository.findById(command.commandId)
        }.thenReturn(
            Optional.empty(),
            Optional.of(MailCommandStatusEntry(command.commandId, CommandStatus.SUCCESS))
        )
        whenever {
            mailerIdempotencyRepository.save(any<MailCommandStatusEntry>())
        }.thenAnswer { invocation -> invocation.getArgument<MailCommandStatusEntry>(0) }

        service.sendEmail(command)
        service.sendEmail(command)

        verify(resendEmail, times(1)).send(any())
    }

    @Test
    fun `send mail saves failed state if exception is thrown`() {
        val command = SendEmailCommand(
            commandId = "command-id",
            templateId = "template-id",
            recipient = "recipient@example.com"
        )

        whenever {
            resend.emails()
        }.thenReturn(resendEmail)

        whenever {
            resendEmail.send(any())
        }.thenThrow(ResendException("error"))

        val savedStatuses = mutableListOf<CommandStatus>()

        whenever {
            mailerIdempotencyRepository.save(any<MailCommandStatusEntry>())
        }.thenAnswer { invocation ->
            invocation.getArgument<MailCommandStatusEntry>(0).also {
                savedStatuses.add(it.status)
            }
        }

        whenever {
            mailerIdempotencyRepository.findById(command.commandId)
        }.thenReturn(
            Optional.empty(),
        )

        service.sendEmail(command)

        assertEquals(
            listOf(CommandStatus.PENDING, CommandStatus.FAILED),
            savedStatuses
        )
    }
}
