package pl.dayfit.mossydevicetrust.messaging

import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import java.util.UUID

data class DeviceEnrolledEvent(
    val userId: UUID,
    val newEnrollment: DeviceEnrollmentsResponseDto.DeviceEnrollmentDto
)