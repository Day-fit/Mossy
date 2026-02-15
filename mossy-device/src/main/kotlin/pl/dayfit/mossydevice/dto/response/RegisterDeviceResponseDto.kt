package pl.dayfit.mossydevice.dto.response

import java.util.UUID

data class RegisterDeviceResponseDto(
    //If true, the user needs to approve a device with a device that is already registered
    val deviceId: UUID,
    val requiresSync: Boolean,
    val syncCode: String?
)