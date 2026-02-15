package pl.dayfit.mossydevice.dto.request

data class RegisterDeviceRequestDto(
    val publicKeyDH: Map<String, Any>,
    val publicKeyId: Map<String, Any>
)