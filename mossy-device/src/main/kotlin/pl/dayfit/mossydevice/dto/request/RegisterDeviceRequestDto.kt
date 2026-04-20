package pl.dayfit.mossydevice.dto.request

data class RegisterDeviceRequestDto(
    val publicKeyDh: Map<String, Any>,
    val publicKeyId: Map<String, Any>
)