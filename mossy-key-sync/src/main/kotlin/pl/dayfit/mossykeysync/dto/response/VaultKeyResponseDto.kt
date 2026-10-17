package pl.dayfit.mossykeysync.dto.response

import java.util.UUID

data class VaultKeyResponseDto (
    val vaultId: UUID,
    val senderId: UUID,
    val cipherText: String,
    val senderPublicDh: String,
    val code: String,
)