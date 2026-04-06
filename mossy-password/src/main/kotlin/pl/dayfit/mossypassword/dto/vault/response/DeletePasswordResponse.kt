package pl.dayfit.mossypassword.dto.vault.response

import pl.dayfit.mossypassword.dto.vault.AbstractVaultResponseType
import java.util.UUID

data class DeletePasswordResponse(
    val domain: String,
    val passwordId: UUID
) : AbstractVaultResponseType()