package messaging.response.type

import java.util.UUID

class SavePasswordResponseType(
    val passwordId: UUID? = null,
    val domain: String? = null
) : AbstractVaultResponseType()