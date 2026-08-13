package pl.dayfit.mossydevicetrust.dto.response

import java.time.Instant
import java.util.UUID

data class DevicesResponseDto(
    val devices: List<DeviceDto>,
) {
    data class DeviceDto(
        val id: UUID,
        val lastOsName: String,
        val deviceType: String,
        val lastSeen: Instant?,
        val blocked: Boolean,
        val current: Boolean,
    )
}
