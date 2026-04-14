package messaging.response.type

import java.util.UUID

data class CiphertextResponseType(
    val ciphertext: String,
    val passwordId: UUID
) : AbstractVaultResponseType()