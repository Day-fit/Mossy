package pl.dayfit.mossypassword.dto.vault.type

data class PasswordSaveRequestType(
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val saveType
) : AbstractVaultRequestType()