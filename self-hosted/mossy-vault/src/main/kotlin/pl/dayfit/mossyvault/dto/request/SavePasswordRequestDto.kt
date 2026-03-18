package pl.dayfit.mossyvault.dto.request

import java.util.UUID

data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val domain: String,
    val cipherText: String,
    val vaultId: String,
    val passwordId: UUID? = null,
    val messageId: UUID? = null
)
