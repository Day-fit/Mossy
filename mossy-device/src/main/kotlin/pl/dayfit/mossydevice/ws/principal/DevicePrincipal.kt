package pl.dayfit.mossydevice.ws.principal

import org.springframework.security.core.Authentication
import java.security.Principal
import java.util.UUID

class DevicePrincipal(
    val deviceId: UUID,
    val authentication: Authentication
) : Principal {
    override fun getName(): String {
        return authentication.name
    }

    
}