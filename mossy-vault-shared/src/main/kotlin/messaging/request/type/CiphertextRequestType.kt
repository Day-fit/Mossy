package messaging.request.type

import java.util.UUID

data class CiphertextRequestType(
    val passwordId: UUID,
) : AbstractVaultRequestType()