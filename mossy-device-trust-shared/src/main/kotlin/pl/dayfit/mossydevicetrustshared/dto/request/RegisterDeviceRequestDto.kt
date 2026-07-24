package pl.dayfit.mossydevicetrustshared.dto.request

import java.util.UUID

data class RegisterDeviceRequestDto(
    val userId: UUID,
    val osName: String,
    val remoteAddr: String,
    val publicIdentityKey: Map<String, Any>,
)