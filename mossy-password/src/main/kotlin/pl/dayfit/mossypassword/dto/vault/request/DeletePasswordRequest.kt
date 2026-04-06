package pl.dayfit.mossypassword.dto.vault.request

import pl.dayfit.mossypassword.dto.vault.AbstractVaultRequestType
import java.util.UUID

data class DeletePasswordRequest(
    val passwordId: UUID
) : AbstractVaultRequestType()
