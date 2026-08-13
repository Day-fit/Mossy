package pl.dayfit.mossydevicetrust.dto.response

import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto

data class CreateDeviceEnrollmentResponseDto(
    val enrollmentId: String,
    val challenge: GenerateChallengeResponseDto
)