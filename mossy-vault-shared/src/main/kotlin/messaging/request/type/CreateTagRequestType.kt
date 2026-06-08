package messaging.request.type

import java.util.UUID

data class SaveTagRequestType(
    val passwordId: UUID,
    val name: String,
    val color: String
) : AbstractVaultRequestType()