package pl.dayfit.mossydevicetrust.dto.response

import java.time.Instant
import java.util.UUID

data class DeviceEnrollmentsResponseDto(
    val enrollments: List<DeviceEnrollmentDto>
) {
    class DeviceEnrollmentDto(
        val id: UUID,

        val lastOsName: String,
        val deviceType: String,

        val remoteAddr: String,
        val createdAt: Instant,
    )
}