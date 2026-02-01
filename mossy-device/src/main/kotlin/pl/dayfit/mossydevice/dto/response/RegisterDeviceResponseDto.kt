package pl.dayfit.mossydevice.dto.response

import java.util.UUID

data class RegisterDeviceResponseDto(
    //If true, the user needs to approve device with device that is already registered
    val deviceId: UUID,
    val requiredApproval: Boolean
)