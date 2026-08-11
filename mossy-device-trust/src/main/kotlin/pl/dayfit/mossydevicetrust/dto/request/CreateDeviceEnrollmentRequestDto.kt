package pl.dayfit.mossydevicetrust.dto.request

data class CreateDeviceEnrollmentRequestDto(
    val userAgent: String,
    val publicIdentityKey: Map<String, Any>,
) : Hashable