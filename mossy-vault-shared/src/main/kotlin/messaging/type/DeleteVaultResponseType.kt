package messaging.type

import java.util.UUID

data class DeleteVaultResponseType(
    private val domain: String,
    val passwordId: UUID
) : AbstractVaultResponseType()