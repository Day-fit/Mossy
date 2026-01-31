package pl.dayfit.mossypassword.dto.request

data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val domain: String,
    val encryptedBlob: String,
    val vaultId: String
)