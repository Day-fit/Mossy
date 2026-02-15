package pl.dayfit.mossydevice.dto.ws

import java.util.UUID

data class NewDeviceInfo(
    val deviceId: UUID,
    val publicKeyDH: Map<String, Any>,
    val publicKeyId: Map<String, Any>
)