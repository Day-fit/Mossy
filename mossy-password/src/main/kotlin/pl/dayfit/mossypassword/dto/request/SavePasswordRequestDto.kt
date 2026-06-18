package pl.dayfit.mossypassword.dto.request

import jakarta.validation.constraints.Size
import type.PasswordType
import java.util.UUID

data class SavePasswordRequestDto(
    val identifier: String, //Email or username
    val address: String,
    @Size(max = 102_400, message = "Cipher text cannot be longer than 102400 characters")
    val cipherText: String,
    val vaultId: UUID,
    val passwordType: PasswordType
)
