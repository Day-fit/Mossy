package pl.dayfit.mossydevice.ws.principal

import java.security.Principal
import java.util.UUID

class DevicePrincipal(
    val deviceId: UUID,
    val userId: UUID,
    val publicDhKey: Map<String, Any>
) : Principal {
    override fun getName(): String {
        return deviceId.toString()
    }
}