package pl.dayfit.mossydevicetrust.model

import com.nimbusds.jose.jwk.OctetKeyPair
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
    var osName: String,
    var publicIdentityKey: OctetKeyPair,

    var createdAt: Instant
)