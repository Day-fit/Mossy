package messaging.response.type

import java.util.UUID

data class DeletePasswordResponseType(
    val domain: String? = null,
    val passwordId: UUID? = null
) : AbstractVaultResponseType()