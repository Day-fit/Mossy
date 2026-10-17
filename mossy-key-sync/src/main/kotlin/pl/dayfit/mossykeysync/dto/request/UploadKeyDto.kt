package pl.dayfit.mossykeysync.dto.request

import java.util.UUID

data class UploadKeyDto (
    val vaultId: UUID,
    val ciphertext: String,
    val publicDh: Map<String, Any>
)