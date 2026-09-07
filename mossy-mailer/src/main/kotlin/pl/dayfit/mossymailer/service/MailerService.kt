package pl.dayfit.mossymailer.service

import com.resend.Resend
import com.resend.services.emails.model.CreateEmailOptions
import com.resend.services.emails.model.Template
import mossymailershared.event.SendEmailCommand
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Service
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry
import pl.dayfit.mossymailer.repository.MailerIdempotencyRepository
import pl.dayfit.mossymailer.type.CommandStatus

@Service
class MailerService(
    private val resend: Resend,
    private val mailerIdempotencyRepository: MailerIdempotencyRepository
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @RabbitListener(queues = ["mossy.email.queue"])
    fun sendEmail(event: SendEmailCommand) {
        val currentStatusEntry = mailerIdempotencyRepository.findById(event.commandId)

        if(currentStatusEntry.isPresent && currentStatusEntry.get().status != CommandStatus.FAILED) {
            return
        }

        val entry = mailerIdempotencyRepository.save(
            MailCommandStatusEntry(
                event.commandId,
                CommandStatus.PENDING
            )
        )

        try {
            resend.emails()
                .send(
                    CreateEmailOptions.builder()
                        .from("Mossy <noreply@dayfit.pl>")
                        .to(event.recipient)
                        .template(
                            Template.builder()
                                .id(event.templateId)
                                .variables(event.variables)
                                .build()
                        )
                        .build()
                )
        } catch (ex: Exception) {
            logger.debug("Error while sending email", ex)

            entry.status = CommandStatus.FAILED
            mailerIdempotencyRepository.save(entry)
            return
        }

        entry.status = CommandStatus.SUCCESS
        mailerIdempotencyRepository.save(entry)
    }
}