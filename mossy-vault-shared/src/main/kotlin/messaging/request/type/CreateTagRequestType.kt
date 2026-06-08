package messaging.request.type

data class CreateTagRequestType(
    val name: String,
    val color: String
) : AbstractVaultRequestType()