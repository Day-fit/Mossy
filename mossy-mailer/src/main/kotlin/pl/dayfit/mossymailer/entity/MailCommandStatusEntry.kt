package pl.dayfit.mossymailer.entity

import org.springframework.data.annotation.Id
import org.springframework.data.redis.core.RedisHash
import pl.dayfit.mossymailer.type.CommandStatus
import java.io.Serializable

@RedisHash("mail_command_status", timeToLive = 60 * 5)
class MailCommandStatusEntry (
    @Id
    val commandId: String,
    var status: CommandStatus = CommandStatus.PENDING
) : Serializable
