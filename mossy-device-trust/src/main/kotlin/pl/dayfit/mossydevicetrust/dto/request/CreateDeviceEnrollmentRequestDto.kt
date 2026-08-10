package pl.dayfit.mossydevicetrust.dto.request

data class CreateDeviceEnrollmentRequestDto(
    val osName: String,
    val publicIdentityKey: Map<String, Any>,
) : Hashable