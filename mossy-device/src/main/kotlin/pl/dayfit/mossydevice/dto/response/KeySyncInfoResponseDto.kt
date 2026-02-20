package pl.dayfit.mossydevice.dto.response

data class KeySyncInfoResponseDto(
    val peerPresent: Boolean,
    val publicKeyDH: Map<String, Any>?,
    val publicKeyId: Map<String, Any>?
)