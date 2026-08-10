package pl.dayfit.mossydevicetrust.dto.response

import java.time.Instant
import java.util.UUID

data class DeviceEnrollmentsResponseDto(
    val enrollments: List<DeviceEnrollmentDto>
) {
    class DeviceEnrollmentDto(
        val id: UUID,

        val osName: String,
        val remoteAddr: String,
        val createdAt: Instant,
    )
}