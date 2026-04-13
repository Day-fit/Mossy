package messaging.request

data class SavePasswordVaultRequestDto(
    val identifier: String,
    val domain: String,
    val cipherText: String,
)
