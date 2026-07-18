package pl.dayfit.mossyauth.service

import org.springframework.stereotype.Service
import java.util.UUID

@Service
class DeviceIntegrationService {
    fun registerDevice(
        userId: UUID,
        publicIdentityKey: Map<String, Any>,
        userAgent: String,
        remoteAddr: String
    ) {

    }
}