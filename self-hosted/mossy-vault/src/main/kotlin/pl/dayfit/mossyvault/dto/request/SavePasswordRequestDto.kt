package pl.dayfit.mossyvault.dto.request

data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val domain: String,
    val cipherText: String,
)
