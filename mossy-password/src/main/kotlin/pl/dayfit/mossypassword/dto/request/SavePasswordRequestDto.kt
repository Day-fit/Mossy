package pl.dayfit.mossypassword.dto.request

import com.fasterxml.jackson.annotation.JsonInclude
import java.util.UUID

@JsonInclude(JsonInclude.Include.NON_NULL)
data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val domain: String,
    val cipherText: String,
    val vaultId: UUID,
    val passwordId: UUID? = null,
    val messageId: UUID? = null
)
