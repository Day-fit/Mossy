package messaging.response.type

import java.util.UUID

data class DeletePasswordResponseType(
    private val domain: String,
    val passwordId: UUID
) : AbstractVaultResponseType()