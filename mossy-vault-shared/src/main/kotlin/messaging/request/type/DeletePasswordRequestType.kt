package messaging.request.type

import java.util.UUID

data class DeletePasswordRequestType(
    val passwordId: UUID
) : AbstractVaultRequestType()