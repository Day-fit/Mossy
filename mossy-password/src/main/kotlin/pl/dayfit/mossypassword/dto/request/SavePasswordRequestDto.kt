package pl.dayfit.mossypassword.dto.request

data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val domain: String,
    val cipherText: String,
    val vaultId: String
)