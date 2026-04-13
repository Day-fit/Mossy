package pl.dayfit.mossypassword.dto.vault.request

import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultRequestType
import java.util.UUID

data class DeletePasswordRequest(
    val passwordId: UUID
) : AbstractVaultRequestType()
