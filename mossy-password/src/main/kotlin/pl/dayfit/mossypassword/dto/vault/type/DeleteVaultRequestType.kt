package pl.dayfit.mossypassword.dto.vault.type

data class DeleteVaultRequestType(
    val domain: String
) : AbstractVaultRequestType()