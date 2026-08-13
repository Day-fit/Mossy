package pl.dayfit.mossydevicetrust.model

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
class DeviceEnrollmentRequest (
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,

    var userId: UUID,
    var remoteAddr: String,
    var userAgent: String,
    var publicIdentityKey: ByteArray,

    var createdAt: Instant
)
