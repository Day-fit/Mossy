package pl.dayfit.mossypassword.dto.vault.request

data class SavePasswordVaultRequestDto(
    val identifier: String,
    val domain: String,
    val cipherText: String,
)
