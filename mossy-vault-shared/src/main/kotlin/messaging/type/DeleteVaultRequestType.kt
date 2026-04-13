package messaging.type

import java.util.UUID

data class DeleteVaultRequestType(
    val passwordId: UUID
) : AbstractVaultRequestType()