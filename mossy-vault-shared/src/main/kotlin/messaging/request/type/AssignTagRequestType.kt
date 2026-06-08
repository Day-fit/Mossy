package messaging.request.type

import java.util.UUID

data class AssignTagRequestType(
    val passwordId: UUID,
    val tagId: UUID
) : AbstractVaultRequestType()