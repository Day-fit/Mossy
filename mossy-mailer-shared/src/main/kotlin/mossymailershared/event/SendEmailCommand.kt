package mossymailershared.event

data class SendEmailCommand(
    val commandId: String,
    val templateId: String,
    var recipient: String,
    val variables: Map<String, String> = emptyMap()
)